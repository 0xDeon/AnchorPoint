#![no_std]

use soroban_sdk::{contract, contractimpl, contracttype, Address, Env};

#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    SuperAdmin,
    IsPaused,
}

#[contract]
pub struct SecurityRegistry;

#[contractimpl]
impl SecurityRegistry {
    pub fn initialize(env: Env, admin: Address) {
        if env.storage().instance().has(&DataKey::SuperAdmin) {
            panic!("already initialized");
        }
        env.storage().instance().set(&DataKey::SuperAdmin, &admin);
        env.storage().instance().set(&DataKey::IsPaused, &false);

        anchorpoint_utils::storage::extend_instance_ttl(
            &env,
            anchorpoint_utils::storage::INSTANCE_THRESHOLD,
            anchorpoint_utils::storage::INSTANCE_EXTEND_TO,
        );
    }

    pub fn pause(env: Env, admin: Address) {
        admin.require_auth();
        let stored_admin: Address = env
            .storage()
            .instance()
            .get(&DataKey::SuperAdmin)
            .expect("not initialized");
        if admin != stored_admin {
            panic!("not super admin");
        }
        env.storage().instance().set(&DataKey::IsPaused, &true);

        anchorpoint_utils::storage::extend_instance_ttl(
            &env,
            anchorpoint_utils::storage::INSTANCE_THRESHOLD,
            anchorpoint_utils::storage::INSTANCE_EXTEND_TO,
        );
    }

    pub fn unpause(env: Env, admin: Address) {
        admin.require_auth();
        let stored_admin: Address = env
            .storage()
            .instance()
            .get(&DataKey::SuperAdmin)
            .expect("not initialized");
        if admin != stored_admin {
            panic!("not super admin");
        }
        env.storage().instance().set(&DataKey::IsPaused, &false);

        anchorpoint_utils::storage::extend_instance_ttl(
            &env,
            anchorpoint_utils::storage::INSTANCE_THRESHOLD,
            anchorpoint_utils::storage::INSTANCE_EXTEND_TO,
        );
    }

    pub fn is_paused(env: Env) -> bool {
        env.storage()
            .instance()
            .get(&DataKey::IsPaused)
            .unwrap_or(false)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use soroban_sdk::testutils::{storage::Instance as _, Address as _};

    #[test]
    fn test_pause_unpause() {
        let env = Env::default();
        let admin = Address::generate(&env);
        let contract_id = env.register(SecurityRegistry, ());
        let client = SecurityRegistryClient::new(&env, &contract_id);

        client.initialize(&admin);
        assert!(!client.is_paused());

        let initial_ttl = env.as_contract(&contract_id, || env.storage().instance().get_ttl());
        assert!(initial_ttl >= anchorpoint_utils::storage::INSTANCE_EXTEND_TO);

        env.mock_all_auths();
        client.pause(&admin);
        assert!(client.is_paused());

        let pause_ttl = env.as_contract(&contract_id, || env.storage().instance().get_ttl());
        assert!(pause_ttl >= anchorpoint_utils::storage::INSTANCE_EXTEND_TO);

        client.unpause(&admin);
        assert!(!client.is_paused());

        let unpause_ttl = env.as_contract(&contract_id, || env.storage().instance().get_ttl());
        assert!(unpause_ttl >= anchorpoint_utils::storage::INSTANCE_EXTEND_TO);
    }
}
