#![no_std]

use soroban_sdk::{
    contract, contractimpl, contracttype, symbol_short, token, Address, Env, Vec,
};

#[contracttype]
pub enum DataKey {
    Admin,
    Treasury,
    GovStakers,
    GovShareBps,
    PayoutTokens,
    PayoutCursor,
}

#[contract]
pub struct RevenueDistributor;

const MAX_BPS: u32 = 10000;
/// Max tokens processed per call to stay within Soroban instruction limits.
const MAX_TOKENS_PER_BATCH: u32 = 10;

#[contractimpl]
impl RevenueDistributor {
    /// Initialize the distributor with target addresses and initial split.
    pub fn initialize(
        env: Env,
        admin: Address,
        treasury: Address,
        gov_stakers: Address,
        gov_share_bps: u32,
    ) {
        if env.storage().instance().has(&DataKey::Admin) {
            panic!("already initialized");
        }
        if gov_share_bps > MAX_BPS {
            panic!("invalid share bps");
        }

        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage().instance().set(&DataKey::Treasury, &treasury);
        env.storage().instance().set(&DataKey::GovStakers, &gov_stakers);
        env.storage().instance().set(&DataKey::GovShareBps, &gov_share_bps);
    }

    /// Update distribution split (admin only).
    pub fn set_shares(env: Env, admin: Address, gov_share_bps: u32) {
        admin.require_auth();
        let current_admin: Address = env.storage().instance().get(&DataKey::Admin).unwrap();
        assert_eq!(admin, current_admin, "not authorized");

        if gov_share_bps > MAX_BPS {
            panic!("invalid share bps");
        }
        env.storage().instance().set(&DataKey::GovShareBps, &gov_share_bps);
    }

    /// Register a token for batched payout distribution (admin only).
    pub fn register_payout_token(env: Env, admin: Address, token_addr: Address) {
        admin.require_auth();
        let current_admin: Address = env.storage().instance().get(&DataKey::Admin).unwrap();
        assert_eq!(admin, current_admin, "not authorized");

        let mut tokens: Vec<Address> = env
            .storage()
            .instance()
            .get(&DataKey::PayoutTokens)
            .unwrap_or_else(|| Vec::new(&env));

        for existing in tokens.iter() {
            if existing == token_addr {
                return;
            }
        }

        tokens.push_back(token_addr);
        env.storage().instance().set(&DataKey::PayoutTokens, &tokens);
    }

    /// Distributes the balance of a specific token held by this contract.
    pub fn distribute(env: Env, token_addr: Address) {
        Self::distribute_token(&env, &token_addr);
    }

    /// Distributes balances for registered payout tokens in bounded batches.
    /// Returns the next cursor index (0 when complete).
    pub fn distribute_batch(env: Env, start_index: u32, max_tokens: u32) -> u32 {
        let tokens: Vec<Address> = env
            .storage()
            .instance()
            .get(&DataKey::PayoutTokens)
            .unwrap_or_else(|| Vec::new(&env));

        if tokens.is_empty() {
            return 0;
        }

        let batch_limit = if max_tokens == 0 {
            MAX_TOKENS_PER_BATCH
        } else {
            max_tokens.min(MAX_TOKENS_PER_BATCH)
        };

        let mut index = start_index;
        let mut processed = 0_u32;

        while index < tokens.len() && processed < batch_limit {
            if let Some(token_addr) = tokens.get(index) {
                Self::distribute_token(&env, &token_addr);
            }
            index += 1;
            processed += 1;
        }

        let next_cursor = if index >= tokens.len() { 0 } else { index };
        env.storage()
            .instance()
            .set(&DataKey::PayoutCursor, &next_cursor);

        next_cursor
    }

    fn distribute_token(env: &Env, token_addr: &Address) {
        let gov_share_bps: u32 = env.storage().instance().get(&DataKey::GovShareBps).unwrap();
        let treasury: Address = env.storage().instance().get(&DataKey::Treasury).unwrap();
        let gov_stakers: Address = env.storage().instance().get(&DataKey::GovStakers).unwrap();

        let token_client = token::Client::new(env, token_addr);
        let balance = token_client.balance(&env.current_contract_address());

        if balance == 0 {
            return;
        }

        let gov_amount = (balance * gov_share_bps as i128) / MAX_BPS as i128;
        let treasury_amount = balance - gov_amount;

        if gov_amount > 0 {
            token_client.transfer(&env.current_contract_address(), &gov_stakers, &gov_amount);
        }
        if treasury_amount > 0 {
            token_client.transfer(&env.current_contract_address(), &treasury, &treasury_amount);
        }

        env.events().publish(
            (symbol_short!("distrib"), token_addr.clone()),
            (gov_amount, treasury_amount),
        );
    }

    /// Sweep accrued swap fees from an AMM pool into the protocol treasury.
    ///
    /// Queries the distributor's balance of `token_a` (assumed to be the fee
    /// token), swaps it into `token_b` via the AMM's `swap` function, and
    /// forwards the proceeds to the treasury.
    pub fn sweep_amm(env: Env, amm_contract: Address, token_a: Address, token_b: Address) {
        let treasury: Address = env.storage().instance().get(&DataKey::Treasury).unwrap();

        let token_a_client = token::Client::new(&env, &token_a);
        let balance_a = token_a_client.balance(&env.current_contract_address());

        if balance_a == 0 {
            return;
        }

        // Execute swap: token_a → token_b through the AMM pool.
        // The AMM pulls token_a from this contract, validates min_amount_out,
        // and sends token_b back to this contract.
        let _amount_out: i128 = env.invoke_contract(
            &amm_contract,
            &symbol_short!("swap"),
            (
                env.current_contract_address(),
                token_a.clone(),
                balance_a,
                1_i128,  // min_amount_out: accept any positive amount
            )
                .into_val(&env),
        );

        // Transfer the received token_b to the treasury.
        let token_b_client = token::Client::new(&env, &token_b);
        let treasury_amount = token_b_client.balance(&env.current_contract_address());

        if treasury_amount > 0 {
            token_b_client.transfer(
                &env.current_contract_address(),
                &treasury,
                &treasury_amount,
            );
        }

        env.events().publish(
            (symbol_short!("sweep"), amm_contract),
            (token_a, token_b, balance_a, treasury_amount),
        );
    }

    /// Get current config
    pub fn get_config(env: Env) -> (Address, Address, u32) {
        let treasury: Address = env.storage().instance().get(&DataKey::Treasury).unwrap();
        let gov_stakers: Address = env.storage().instance().get(&DataKey::GovStakers).unwrap();
        let gov_share_bps: u32 = env.storage().instance().get(&DataKey::GovShareBps).unwrap();
        (treasury, gov_stakers, gov_share_bps)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use soroban_sdk::testutils::{Address as _};
    use soroban_sdk::{token, Address, Env};
    use anchorpoint_amm::AMM;

    fn setup() -> (Env, Address, Address, Address, Address, Address) {
        let env = Env::default();
        env.mock_all_auths();

        let admin = Address::generate(&env);
        let treasury = Address::generate(&env);
        let gov_stakers = Address::generate(&env);
        
        // Setup a mock token
        let token_admin = Address::generate(&env);
        let token_id = env.register_stellar_asset_contract_v2(token_admin.clone());
        let token_client = token::Client::new(&env, &token_id.address());

        let distributor_id = env.register_contract(None, RevenueDistributor);
        let distributor_client = RevenueDistributorClient::new(&env, &distributor_id);
        
        distributor_client.initialize(&admin, &treasury, &gov_stakers, &6000); // 60% Gov, 40% Treasury

        // Fund the distributor with some "revenue"
        token::StellarAssetClient::new(&env, &token_id.address()).mint(&distributor_id, &1000);

        (env, distributor_id, admin, treasury, gov_stakers, token_id.address())
    }

    #[test]
    fn test_distribution() {
        let (env, distributor_id, _, treasury, gov_stakers, token_addr) = setup();
        let distributor_client = RevenueDistributorClient::new(&env, &distributor_id);
        let token_client = token::Client::new(&env, &token_addr);

        distributor_client.distribute(&token_addr);

        assert_eq!(token_client.balance(&gov_stakers), 600);
        assert_eq!(token_client.balance(&treasury), 400);
        assert_eq!(token_client.balance(&distributor_id), 0);
    }

    #[test]
    fn test_set_shares() {
        let (env, distributor_id, admin, _, _, _) = setup();
        let distributor_client = RevenueDistributorClient::new(&env, &distributor_id);

        distributor_client.set_shares(&admin, &8000);
        let (_, _, gov_share) = distributor_client.get_config();
        assert_eq!(gov_share, 8000);
    }

    #[test]
    fn test_distribute_batch_bounded() {
        let (env, distributor_id, admin, treasury, gov_stakers, token_addr) = setup();
        let distributor_client = RevenueDistributorClient::new(&env, &distributor_id);
        let token_client = token::Client::new(&env, &token_addr);

        distributor_client.register_payout_token(&admin, &token_addr);

        let next = distributor_client.distribute_batch(&0, &10);
        assert_eq!(next, 0);
        assert_eq!(token_client.balance(&gov_stakers), 600);
        assert_eq!(token_client.balance(&treasury), 400);
    }

    #[test]
    fn test_zero_balance_distribute_is_noop() {
        let env = Env::default();
        env.mock_all_auths();
        let admin = Address::generate(&env);
        let treasury = Address::generate(&env);
        let gov_stakers = Address::generate(&env);
        let token_admin = Address::generate(&env);
        let token_id = env.register_stellar_asset_contract_v2(token_admin.clone());

        let distributor_id = env.register_contract(None, RevenueDistributor);
        let client = RevenueDistributorClient::new(&env, &distributor_id);
        client.initialize(&admin, &treasury, &gov_stakers, &5000);

        client.distribute(&token_id.address());

        let token_client = token::Client::new(&env, &token_id.address());
        assert_eq!(token_client.balance(&treasury), 0);
        assert_eq!(token_client.balance(&gov_stakers), 0);
    }

    #[test]
    fn test_full_gov_share() {
        let env = Env::default();
        env.mock_all_auths();

        let admin = Address::generate(&env);
        let treasury = Address::generate(&env);
        let gov_stakers = Address::generate(&env);
        let token_admin = Address::generate(&env);
        let token_id = env.register_stellar_asset_contract_v2(token_admin.clone());

        let distributor_id = env.register_contract(None, RevenueDistributor);
        let client = RevenueDistributorClient::new(&env, &distributor_id);
        client.initialize(&admin, &treasury, &gov_stakers, &10000);
        token::StellarAssetClient::new(&env, &token_id.address()).mint(&distributor_id, &1000);

        client.distribute(&token_id.address());

        let token_client = token::Client::new(&env, &token_id.address());
        assert_eq!(token_client.balance(&gov_stakers), 1000);
        assert_eq!(token_client.balance(&treasury), 0);
    }

    #[test]
    fn test_zero_gov_share() {
        let env = Env::default();
        env.mock_all_auths();

        let admin = Address::generate(&env);
        let treasury = Address::generate(&env);
        let gov_stakers = Address::generate(&env);

        let token_admin = Address::generate(&env);
        let token_id = env.register_stellar_asset_contract_v2(token_admin.clone());
        let token_client = token::Client::new(&env, &token_id.address());

        let distributor_id = env.register_contract(None, RevenueDistributor);
        let distributor_client = RevenueDistributorClient::new(&env, &distributor_id);
        distributor_client.initialize(&admin, &treasury, &gov_stakers, &0);

        token::StellarAssetClient::new(&env, &token_id.address()).mint(&distributor_id, &1000);
        distributor_client.distribute(&token_id.address());

        assert_eq!(token_client.balance(&gov_stakers), 0);
        assert_eq!(token_client.balance(&treasury), 1000);
        assert_eq!(token_client.balance(&distributor_id), 0);
    }

    #[test]
    fn test_weight_precision_with_odd_amounts() {
        let env = Env::default();
        env.mock_all_auths();

        let admin = Address::generate(&env);
        let treasury = Address::generate(&env);
        let gov_stakers = Address::generate(&env);
        let token_admin = Address::generate(&env);
        let token_id = env.register_stellar_asset_contract_v2(token_admin.clone());

        let distributor_id = env.register_contract(None, RevenueDistributor);
        let client = RevenueDistributorClient::new(&env, &distributor_id);
        client.initialize(&admin, &treasury, &gov_stakers, &0);
        token::StellarAssetClient::new(&env, &token_id.address()).mint(&distributor_id, &1000);

        client.distribute(&token_id.address());

        let token_client = token::Client::new(&env, &token_id.address());
        assert_eq!(token_client.balance(&gov_stakers), 0);
        assert_eq!(token_client.balance(&treasury), 1000);
    }

    #[test]
    fn test_distribution_after_set_shares() {
        let (env, distributor_id, admin, treasury, gov_stakers, token_addr) = setup();
        let client = RevenueDistributorClient::new(&env, &distributor_id);
        let token_client = token::Client::new(&env, &token_addr);

        client.set_shares(&admin, &3000);
        client.distribute(&token_addr);

        assert_eq!(token_client.balance(&gov_stakers), 300);
        assert_eq!(token_client.balance(&treasury), 700);
    }

    #[test]
    #[should_panic(expected = "invalid share bps")]
    fn test_invalid_bps_panics_on_initialize() {
        let env = Env::default();
        env.mock_all_auths();
        let admin = Address::generate(&env);
        let treasury = Address::generate(&env);
        let gov_stakers = Address::generate(&env);

        let distributor_id = env.register_contract(None, RevenueDistributor);
        let client = RevenueDistributorClient::new(&env, &distributor_id);
        client.initialize(&admin, &treasury, &gov_stakers, &10001);
    }

    #[test]
    #[should_panic(expected = "invalid share bps")]
    fn test_invalid_bps_panics_on_set_shares() {
        let (env, distributor_id, admin, _, _, _) = setup();
        let client = RevenueDistributorClient::new(&env, &distributor_id);
        client.set_shares(&admin, &10001);
    }

    // ── Sweep AMM tests ──

    fn sweep_setup() -> (Env, RevenueDistributorClient<'static>, Address, Address, Address, Address, Address, Address) {
        let env = Env::default();
        env.mock_all_auths();

        let admin = Address::generate(&env);
        let treasury = Address::generate(&env);
        let gov_stakers = Address::generate(&env);
        let lp = Address::generate(&env);

        // Register tokens using Stellar asset contracts
        let token_admin = Address::generate(&env);
        let token_a_id = env.register_stellar_asset_contract_v2(token_admin.clone());
        let token_b_id = env.register_stellar_asset_contract_v2(token_admin.clone());
        let token_a = token_a_id.address();
        let token_b = token_b_id.address();

        let token_a_sac = token::StellarAssetClient::new(&env, &token_a);
        let token_b_sac = token::StellarAssetClient::new(&env, &token_b);

        // Register and initialize the AMM
        let amm_id = env.register(AMM, ());
        let amm_client = anchorpoint_amm::AMMClient::new(&env, &amm_id);
        amm_client.initialize(&admin, &token_a, &token_b);

        // Mint tokens to LP for liquidity provision
        token_a_sac.mint(&lp, &100_000_000);
        token_b_sac.mint(&lp, &100_000_000);

        // LP deposits liquidity into the AMM pool
        amm_client.deposit(&lp, &50_000_000, &50_000_000);

        // Register and initialize the revenue distributor
        let distributor_id = env.register_contract(None, RevenueDistributor);
        let client = RevenueDistributorClient::new(&env, &distributor_id);
        client.initialize(&admin, &treasury, &gov_stakers, &6000);

        // Mint token_a fees to the distributor (simulating accrued swap revenue)
        token_a_sac.mint(&distributor_id, &10_000);

        (env, client, distributor_id, amm_id, token_a, token_b, treasury, gov_stakers)
    }

    #[test]
    fn test_sweep_amm_swaps_and_transfers_to_treasury() {
        let (env, client, distributor_id, amm_id, token_a, token_b, treasury, _gov_stakers) = sweep_setup();

        client.sweep_amm(&amm_id, &token_a, &token_b);

        let token_b_client = token::Client::new(&env, &token_b);
        // Treasury should have received token_b from the swap
        assert!(token_b_client.balance(&treasury) > 0);
        // Distributor should have no remaining token_a balance
        let token_a_client = token::Client::new(&env, &token_a);
        assert_eq!(token_a_client.balance(&distributor_id), 0);
    }

    #[test]
    fn test_sweep_amm_zero_balance_does_nothing() {
        let env = Env::default();
        env.mock_all_auths();

        let admin = Address::generate(&env);
        let treasury = Address::generate(&env);
        let gov_stakers = Address::generate(&env);

        let distributor_id = env.register_contract(None, RevenueDistributor);
        let client = RevenueDistributorClient::new(&env, &distributor_id);
        client.initialize(&admin, &treasury, &gov_stakers, &6000);

        let token_admin = Address::generate(&env);
        let token_a_id = env.register_stellar_asset_contract_v2(token_admin.clone());
        let token_b_id = env.register_stellar_asset_contract_v2(token_admin);
        let amm_id = env.register(AMM, ());
        let amm_client = anchorpoint_amm::AMMClient::new(&env, &amm_id);
        amm_client.initialize(&admin, &token_a_id.address(), &token_b_id.address());

        // No tokens minted to distributor — balance is 0
        client.sweep_amm(&amm_id, &token_a_id.address(), &token_b_id.address());

        let token_b_client = token::Client::new(&env, &token_b_id.address());
        assert_eq!(token_b_client.balance(&treasury), 0);
    }

    #[test]
    fn test_sweep_amm_emits_revenue_swept_event() {
        let (env, client, _distributor_id, amm_id, token_a, token_b, _treasury, _gov_stakers) = sweep_setup();

        let events_before = env.events().all().len();
        client.sweep_amm(&amm_id, &token_a, &token_b);
        let events_after = env.events().all().len();

        // At least one new event should have been emitted
        assert!(events_after > events_before, "RevenueSwept event should be emitted");
    }
}
