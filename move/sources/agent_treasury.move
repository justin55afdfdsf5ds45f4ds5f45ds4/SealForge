module sealforge::agent_treasury {
    use sui::clock::Clock;
    use sui::event;

    // === Structs ===

    public struct AgentTreasury has key, store {
        id: UID,
        agent_address: address,
        agent_name: vector<u8>,
        total_earned: u64,
        total_spent: u64,
        total_content_created: u64,
        total_sales: u64,
        created_at: u64,
    }

    // === Events ===

    public struct AgentCreated has copy, drop {
        treasury_id: ID,
        agent_name: vector<u8>,
    }

    public struct ActionRecorded has copy, drop {
        treasury_id: ID,
        action_type: vector<u8>,
        description: vector<u8>,
        amount: u64,
    }

    public struct ProfitMilestone has copy, drop {
        treasury_id: ID,
        total_earned: u64,
        total_spent: u64,
    }

    // === Public functions ===

    /// Create agent treasury (call once after deploy)
    entry fun create_treasury(
        agent_name: vector<u8>,
        clock: &Clock,
        ctx: &mut TxContext,
    ) {
        let treasury = AgentTreasury {
            id: object::new(ctx),
            agent_address: ctx.sender(),
            agent_name,
            total_earned: 0,
            total_spent: 0,
            total_content_created: 0,
            total_sales: 0,
            created_at: clock.timestamp_ms(),
        };
        let treasury_id = object::id(&treasury);

        event::emit(AgentCreated {
            treasury_id,
            agent_name: treasury.agent_name,
        });

        transfer::transfer(treasury, ctx.sender());
    }

    /// Record earning (from a sale)
    entry fun record_earning(
        treasury: &mut AgentTreasury,
        description: vector<u8>,
        amount: u64,
        _clock: &Clock,
    ) {
        treasury.total_earned = treasury.total_earned + amount;
        treasury.total_sales = treasury.total_sales + 1;

        let treasury_id = object::id(treasury);

        event::emit(ActionRecorded {
            treasury_id,
            action_type: b"sale",
            description,
            amount,
        });

        // Emit profit milestone if profitable
        if (treasury.total_earned > treasury.total_spent) {
            event::emit(ProfitMilestone {
                treasury_id,
                total_earned: treasury.total_earned,
                total_spent: treasury.total_spent,
            });
        };
    }

    /// Record spending (gas, walrus upload cost)
    entry fun record_spending(
        treasury: &mut AgentTreasury,
        description: vector<u8>,
        amount: u64,
        _clock: &Clock,
    ) {
        treasury.total_spent = treasury.total_spent + amount;

        event::emit(ActionRecorded {
            treasury_id: object::id(treasury),
            action_type: b"expense",
            description,
            amount,
        });
    }

    /// Record content creation
    entry fun record_content_created(
        treasury: &mut AgentTreasury,
        description: vector<u8>,
        _clock: &Clock,
    ) {
        treasury.total_content_created = treasury.total_content_created + 1;

        event::emit(ActionRecorded {
            treasury_id: object::id(treasury),
            action_type: b"content_created",
            description,
            amount: 0,
        });
    }

    // === View functions ===

    public fun is_profitable(treasury: &AgentTreasury): bool {
        treasury.total_earned > treasury.total_spent
    }

    public fun get_net_profit(treasury: &AgentTreasury): u64 {
        if (treasury.total_earned > treasury.total_spent) {
            treasury.total_earned - treasury.total_spent
        } else {
            0
        }
    }
}
