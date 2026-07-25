#![no_std]

use soroban_sdk::{
    contract, contractimpl, contracttype, symbol_short, token, xdr::ToXdr, Address, BytesN, Env,
    IntoVal, Vec,
};

#[contracttype]
pub enum DataKey {
    Admin,
    BridgeToken,
    Relayer,
    Processed(BytesN<32>),
}

/// Client for cross-contract invocation of the Bridge Stub contract.
///
/// Other contracts can instantiate this client and call `burn` or `mint`
/// without needing to use `invoke_contract` directly.
pub struct BridgeContractClient<'a> {
    env: &'a Env,
    contract_id: &'a Address,
}

impl<'a> BridgeContractClient<'a> {
    pub fn new(env: &'a Env, contract_id: &'a Address) -> Self {
        Self { env, contract_id }
    }

    pub fn burn(
        &self,
        user: &Address,
        amount: &i128,
        dest_chain: &u32,
        dest_recipient: &BytesN<32>,
    ) {
        self.env.invoke_contract::<()>(
            self.contract_id,
            &symbol_short!("burn"),
            (user.clone(), *amount, *dest_chain, dest_recipient.clone()).into_val(self.env),
        );
    }

    pub fn mint(
        &self,
        relayer: &Address,
        recipient: &Address,
        amount: &i128,
        source_chain: &u32,
        nonce: &u64,
    ) {
        self.env.invoke_contract::<()>(
            self.contract_id,
            &symbol_short!("mint"),
            (
                relayer.clone(),
                recipient.clone(),
                *amount,
                *source_chain,
                *nonce,
            )
                .into_val(self.env),
        );
    }
}

#[contract]
pub struct BridgeStub;

#[contractimpl]
impl BridgeStub {
    /// Initialize the bridge with an admin, the token to bridge, and the authorized relayer.
    pub fn initialize(env: Env, admin: Address, bridge_token: Address, relayer: Address) {
        if env.storage().instance().has(&DataKey::Admin) {
            panic!("already initialized");
        }
        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage()
            .instance()
            .set(&DataKey::BridgeToken, &bridge_token);
        env.storage().instance().set(&DataKey::Relayer, &relayer);
    }

    /// Burns tokens on this chain to be moved to another chain.
    /// Emits a 'burn' event for off-chain relayers.
    pub fn burn(
        env: Env,
        user: Address,
        amount: i128,
        dest_chain: u32,
        dest_recipient: BytesN<32>,
    ) {
        user.require_auth();
        assert!(amount > 0, "amount must be positive");

        let bridge_token: Address = env
            .storage()
            .instance()
            .get(&DataKey::BridgeToken)
            .unwrap();

        token::Client::new(&env, &bridge_token).transfer(
            &user,
            &env.current_contract_address(),
            &amount,
        );

        // Emit event following strict indexed schema
        env.events()
            .publish((symbol_short!("br_burn"), user, amount, dest_chain), dest_recipient);
    }

    /// Mints tokens on this chain based on a verified message from another chain.
    /// The relayer must authorize this transaction.
    pub fn mint(
        env: Env,
        relayer: Address,
        recipient: Address,
        amount: i128,
        source_chain: u32,
        nonce: u64,
    ) {
        relayer.require_auth();

        let authorized_relayer: Address = env
            .storage()
            .instance()
            .get(&DataKey::Relayer)
            .unwrap();
        if relayer != authorized_relayer {
            panic!("not authorized relayer");
        }

        // Construct the message hash for replay protection
        let mut msg_data: Vec<soroban_sdk::Val> = Vec::new(&env);
        msg_data.push_back(recipient.clone().into_val(&env));
        msg_data.push_back(amount.into_val(&env));
        msg_data.push_back(source_chain.into_val(&env));
        msg_data.push_back(nonce.into_val(&env));

        // For this stub, we'll use a simpler unique key
        let msg_hash = env.crypto().sha256(&recipient.clone().to_xdr(&env));

        // Replay protection
        let processed_key = DataKey::Processed(msg_hash.clone().into());
        if env.storage().persistent().has(&processed_key) {
            panic!("message already processed");
        }

        // Mark as processed
        env.storage().persistent().set(&processed_key, &true);

        // Mint/Transfer tokens
        let bridge_token: Address = env
            .storage()
            .instance()
            .get(&DataKey::BridgeToken)
            .unwrap();
        token::Client::new(&env, &bridge_token).transfer(
            &env.current_contract_address(),
            &recipient,
            &amount,
        );

        // Emit event
        env.events()
            .publish((symbol_short!("br_mint"), recipient, amount, source_chain), nonce);
    }

    /// Update relayer address (admin only)
    pub fn set_relayer(env: Env, admin: Address, new_relayer: Address) {
        admin.require_auth();
        let current_admin: Address = env
            .storage()
            .instance()
            .get(&DataKey::Admin)
            .unwrap();
        assert_eq!(admin, current_admin, "not authorized");

        env.storage()
            .instance()
            .set(&DataKey::Relayer, &new_relayer);
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use soroban_sdk::{
        testutils::{Address as _},
        token,
        Address, BytesN, Env,
    };

    fn setup() -> (Env, Address, Address, Address, Address, Address) {
        let env = Env::default();
        env.mock_all_auths();

        let admin = Address::generate(&env);
        let user = Address::generate(&env);
        let relayer = Address::generate(&env);

        // Setup a mock token
        let token_admin = Address::generate(&env);
        let token_id = env.register_stellar_asset_contract_v2(token_admin.clone());
        let token_client = token::StellarAssetClient::new(&env, &token_id.address());
        token_client.mint(&user, &1000);

        let bridge_id = env.register_contract(None, BridgeStub);
        let bridge_client = BridgeStubClient::new(&env, &bridge_id);
        bridge_client.initialize(&admin, &token_id.address(), &relayer);

        // Give bridge contract some tokens to "mint"
        token_client.mint(&bridge_id, &10000);

        (env, bridge_id, admin, user, token_id.address(), relayer)
    }

    /// A mock contract that uses BridgeContractClient to call the bridge.
    ///
    /// In a real-world scenario the calling contract would first authenticate
    /// the user/relayer before invoking the bridge (as demonstrated below).
    #[contract]
    pub struct MockCaller;

    #[contractimpl]
    impl MockCaller {
        pub fn call_bridge_burn(
            env: Env,
            bridge_id: Address,
            user: Address,
            amount: i128,
            dest_chain: u32,
            dest_recipient: BytesN<32>,
        ) {
            user.require_auth();
            let bridge = BridgeContractClient::new(&env, &bridge_id);
            bridge.burn(&user, &amount, &dest_chain, &dest_recipient);
        }

        pub fn call_bridge_mint(
            env: Env,
            bridge_id: Address,
            relayer: Address,
            recipient: Address,
            amount: i128,
            source_chain: u32,
            nonce: u64,
        ) {
            relayer.require_auth();
            let bridge = BridgeContractClient::new(&env, &bridge_id);
            bridge.mint(&relayer, &recipient, &amount, &source_chain, &nonce);
        }
    }

    #[test]
    fn test_burn_event() {
        let (env, bridge_id, _, user, _, _) = setup();
        let bridge_client = BridgeStubClient::new(&env, &bridge_id);

        let dest_recipient = BytesN::from_array(&env, &[7u8; 32]);
        bridge_client.burn(&user, &100, &2, &dest_recipient);
    }

    #[test]
    fn test_mint_authorized() {
        let (env, bridge_id, _, user, _, relayer) = setup();
        let bridge_client = BridgeStubClient::new(&env, &bridge_id);

        let amount = 50i128;
        let source_chain = 1u32;
        let nonce = 123u64;

        bridge_client.mint(&relayer, &user, &amount, &source_chain, &nonce);
    }

    #[test]
    fn test_cross_contract_burn_via_bridge_client() {
        let (env, bridge_id, _admin, user, _token_addr, _relayer) = setup();

        let caller_id = env.register_contract(None, MockCaller);
        let caller = MockCallerClient::new(&env, &caller_id);

        let dest_recipient = BytesN::from_array(&env, &[7u8; 32]);
        caller.call_bridge_burn(&bridge_id, &user, &100, &2, &dest_recipient);
    }

    #[test]
    fn test_cross_contract_mint_via_bridge_client() {
        let (env, bridge_id, _admin, user, _token_addr, relayer) = setup();

        let caller_id = env.register_contract(None, MockCaller);
        let caller = MockCallerClient::new(&env, &caller_id);

        caller.call_bridge_mint(&bridge_id, &relayer, &user, &50, &1, &123);
    }
}
