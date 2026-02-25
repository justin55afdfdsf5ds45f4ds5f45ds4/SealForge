module sealforge::content_marketplace {
    use sui::coin::{Self, Coin};
    use sui::sui::SUI;
    use sui::clock::Clock;
    use sui::event;

    // === Error codes ===
    const ENoAccess: u64 = 0;
    const EInvalidPayment: u64 = 1;
    const ENotOwner: u64 = 2;
    const EAlreadyPurchased: u64 = 3;
    const EInvalidPrefix: u64 = 4;

    // === Structs ===

    /// Shared object: global registry of all listings
    public struct Marketplace has key {
        id: UID,
        listings: vector<ID>,
        total_sales: u64,
        total_listings: u64,
    }

    /// Each content listing created by the agent
    public struct ContentListing has key, store {
        id: UID,
        creator: address,
        title: vector<u8>,
        description: vector<u8>,
        walrus_blob_id: vector<u8>,
        seal_policy_id: vector<u8>,
        thumbnail_url: vector<u8>,
        price: u64,
        buyers: vector<address>,
        total_revenue: u64,
        created_at: u64,
        is_active: bool,
    }

    /// Admin capability for managing a listing
    public struct ListingCap has key, store {
        id: UID,
        listing_id: ID,
    }

    // === Events ===

    public struct ListingCreated has copy, drop {
        listing_id: ID,
        title: vector<u8>,
        price: u64,
        creator: address,
    }

    public struct ContentPurchased has copy, drop {
        listing_id: ID,
        buyer: address,
        price: u64,
        walrus_blob_id: vector<u8>,
    }

    public struct BlobUpdated has copy, drop {
        listing_id: ID,
        walrus_blob_id: vector<u8>,
    }

    // === Init ===

    fun init(ctx: &mut TxContext) {
        let marketplace = Marketplace {
            id: object::new(ctx),
            listings: vector::empty(),
            total_sales: 0,
            total_listings: 0,
        };
        transfer::share_object(marketplace);
    }

    // === Public functions ===

    /// Agent creates a new content listing.
    /// walrus_blob_id starts empty — set via update_blob_id after encrypt+upload.
    entry fun create_listing(
        marketplace: &mut Marketplace,
        title: vector<u8>,
        description: vector<u8>,
        thumbnail_url: vector<u8>,
        price: u64,
        clock: &Clock,
        ctx: &mut TxContext,
    ) {
        let listing = ContentListing {
            id: object::new(ctx),
            creator: ctx.sender(),
            title,
            description,
            walrus_blob_id: vector::empty(),
            seal_policy_id: vector::empty(),
            thumbnail_url,
            price,
            buyers: vector::empty(),
            total_revenue: 0,
            created_at: clock.timestamp_ms(),
            is_active: true,
        };
        let listing_id = object::id(&listing);

        // Add to marketplace registry
        marketplace.listings.push_back(listing_id);
        marketplace.total_listings = marketplace.total_listings + 1;

        event::emit(ListingCreated {
            listing_id,
            title: listing.title,
            price,
            creator: ctx.sender(),
        });

        // Create admin cap for the listing
        let cap = ListingCap {
            id: object::new(ctx),
            listing_id,
        };
        transfer::transfer(cap, ctx.sender());

        // Share the listing so buyers and Seal key servers can access it
        transfer::share_object(listing);
    }

    /// Update the Walrus blob ID on a listing (only via ListingCap)
    entry fun update_blob_id(
        cap: &ListingCap,
        listing: &mut ContentListing,
        walrus_blob_id: vector<u8>,
    ) {
        assert!(cap.listing_id == object::id(listing), ENotOwner);
        listing.walrus_blob_id = walrus_blob_id;

        event::emit(BlobUpdated {
            listing_id: object::id(listing),
            walrus_blob_id,
        });
    }

    /// Buyer purchases access to content
    entry fun purchase(
        marketplace: &mut Marketplace,
        listing: &mut ContentListing,
        mut payment: Coin<SUI>,
        _clock: &Clock,
        ctx: &mut TxContext,
    ) {
        let buyer = ctx.sender();

        // Check not already purchased
        assert!(!listing.buyers.contains(&buyer), EAlreadyPurchased);

        // Check payment is sufficient
        assert!(coin::value(&payment) >= listing.price, EInvalidPayment);

        // Split exact price and send to creator
        let paid = coin::split(&mut payment, listing.price, ctx);
        transfer::public_transfer(paid, listing.creator);

        // Return change to buyer
        if (coin::value(&payment) > 0) {
            transfer::public_transfer(payment, buyer);
        } else {
            coin::destroy_zero(payment);
        };

        // Record the purchase
        listing.buyers.push_back(buyer);
        listing.total_revenue = listing.total_revenue + listing.price;
        marketplace.total_sales = marketplace.total_sales + 1;

        event::emit(ContentPurchased {
            listing_id: object::id(listing),
            buyer,
            price: listing.price,
            walrus_blob_id: listing.walrus_blob_id,
        });
    }

    // === Seal Integration ===

    /// seal_approve — Seal key servers call this to verify decrypt access.
    /// The `id` parameter is the encryption identity: [listing_object_id_bytes][nonce].
    /// This function checks that the caller has purchased the listing.
    /// MUST be side-effect free. Aborts if access denied.
    entry fun seal_approve(id: vector<u8>, listing: &ContentListing, ctx: &TxContext) {
        let sender = ctx.sender();

        // Verify the id has this listing's object ID as prefix
        let listing_id_bytes = object::id_bytes(listing);
        assert!(is_prefix(&listing_id_bytes, &id), EInvalidPrefix);

        // Check access: must be creator or buyer
        assert!(
            listing.creator == sender || listing.buyers.contains(&sender),
            ENoAccess,
        );
    }

    // === View functions ===

    public fun has_purchased(listing: &ContentListing, buyer: address): bool {
        listing.buyers.contains(&buyer)
    }

    public fun get_price(listing: &ContentListing): u64 {
        listing.price
    }

    public fun get_buyer_count(listing: &ContentListing): u64 {
        listing.buyers.length()
    }

    // === Internal helpers ===

    /// Check if `prefix` is a prefix of `word`
    fun is_prefix(prefix: &vector<u8>, word: &vector<u8>): bool {
        if (prefix.length() > word.length()) {
            return false
        };
        let mut i = 0;
        while (i < prefix.length()) {
            if (prefix[i] != word[i]) {
                return false
            };
            i = i + 1;
        };
        true
    }
}
