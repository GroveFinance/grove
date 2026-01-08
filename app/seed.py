# app/seed.py

from sqlalchemy.exc import IntegrityError

from app.db import SessionLocal
from app.logger import logger
from app.models import Category, Group, Meta

INITIAL_CATEGORIES = {
    "Income": [
        {"name": "Paycheck"},
        {"name": "Bonus"},
        {"name": "Interest Income"},
        {"name": "Investment Income"},
        {"name": "Other Income"},
    ],
    "Bills & Utilities": [
        {"name": "Electric"},
        {"name": "Gas"},
        {"name": "Water"},
        {"name": "Trash"},
        {"name": "Internet"},
        {"name": "Mobile Phone"},
        {"name": "TV/Streaming"},
        {"name": "Rent"},
        {"name": "Mortgage"},
        {"name": "HOA Fees"},
        {"name": "Other Bills"},
    ],
    "Home": [
        {"name": "Home Improvement"},
        {"name": "Home Services"},
        {"name": "Furnishings"},
        {"name": "Maintenance"},
        {"name": "Home Insurance"},
    ],
    "Auto & Transport": [
        {"name": "Gas & Fuel", "budget": 200},
        {"name": "Auto Insurance"},
        {"name": "Parking", "budget": 40},
        {"name": "Service & Parts"},
        {"name": "Auto Payment"},
        {"name": "Public Transit", "budget": 60},
        {"name": "Ride Share"},
    ],
    "Food & Dining": [
        {"name": "Groceries", "budget": 500},
        {"name": "Restaurants", "budget": 200},
        {"name": "Fast Food", "budget": 100},
        {"name": "Coffee Shops", "budget": 50},
        {"name": "Alcohol & Bars", "budget": 75},
        {"name": "Delivery", "budget": 60},
    ],
    "Shopping": [
        {"name": "Clothing", "budget": 100},
        {"name": "Electronics & Software"},
        {"name": "Hobbies", "budget": 75},
        {"name": "Sporting Goods"},
        {"name": "Online Shopping"},
        {"name": "Subscription Services", "budget": 100},
        {"name": "Gifts & Donations"},
    ],
    "Health & Fitness": [
        {"name": "Pharmacy"},
        {"name": "Health Insurance"},
        {"name": "Doctor"},
        {"name": "Dentist"},
        {"name": "Eye Care"},
        {"name": "Gym"},
        {"name": "Sports"},
    ],
    "Kids": [
        {"name": "Childcare"},
        {"name": "Kids Clothing", "budget": 80},
        {"name": "Toys", "budget": 40},
        {"name": "Baby Supplies", "budget": 100},
        {"name": "Education", "budget": 200},
        {"name": "Activities", "budget": 100},
    ],
    "Pets": [
        {"name": "Pet Food", "budget": 75},
        {"name": "Veterinary"},
        {"name": "Grooming", "budget": 40},
        {"name": "Boarding & Daycare", "budget": 50},
        {"name": "Pet Supplies", "budget": 30},
    ],
    "Entertainment": [
        {"name": "Movies", "budget": 20},
        {"name": "Music", "budget": 20},
        {"name": "Books", "budget": 20},
        {"name": "Games", "budget": 30},
        {"name": "Events", "budget": 50},
    ],
    "Personal Care": [
        {"name": "Hair", "budget": 40},
        {"name": "Spa & Massage"},
        {"name": "Cosmetics", "budget": 30},
        {"name": "Laundry"},
        {"name": "Other Personal Care"},
    ],
    "Travel": [
        {"name": "Airfare"},
        {"name": "Hotel"},
        {"name": "Rental Car & Taxi"},
        {"name": "Vacation"},
        {"name": "Other Travel"},
    ],
    "Finance": [
        {"name": "Bank Fee"},
        {"name": "Credit Card Payment"},
        {"name": "Loan Payment"},
        {"name": "Investment"},
        {"name": "Savings"},
        {"name": "Taxes"},
        {"name": "Transfer"},
    ],
    "Uncategorized": [
        {"name": "Miscellaneous"},
        {"name": "Uncategorized"},
    ],
}


def seed_initial_categories():
    """
    Setup the group/uncategorized initial setup. we need uncategorized to be 0 based on some other assumptions around how its used
    """
    db = SessionLocal()
    if db.query(Meta).filter_by(key="initial_seed_complete").first():
        logger.info("✅ Seed already complete.")
        return

    try:
        # 1. Ensure groups exist
        logger.debug("Seeding - Creating groups")
        group_map = {}
        for group_name in INITIAL_CATEGORIES.keys():
            group = db.query(Group).filter_by(name=group_name).first()
            if not group:
                group = Group(name=group_name)
                db.add(group)
                db.flush()
            group_map[group_name] = group
        db.commit()  # commit here so group ids are persisted

        # 2. Handle Uncategorized (id=0)
        logger.debug("Seeding - Handling special case Uncategorized")
        uncat_category = db.get(Category, 0)
        if not uncat_category:
            uncategorized_group = group_map.get("Uncategorized")
            if uncategorized_group:
                db.add(
                    Category(
                        id=0,
                        name="Uncategorized",
                        group_id=uncategorized_group.id,
                        budget=0,
                    )
                )
                db.commit()

        # 3. Seed other categories
        logger.debug("Seeding - Creating categories")
        for group_name, cat_list in INITIAL_CATEGORIES.items():
            group = group_map[group_name]
            for cat in cat_list:
                name = cat["name"]
                budget = cat.get("budget")
                exists = db.query(Category).filter_by(name=name).first()
                if not exists:
                    if group_name == "Uncategorized":
                        # skip, handled explicitly above
                        continue
                    db.add(Category(name=name, group_id=group.id, budget=budget))
        db.add(Meta(key="initial_seed_complete", value="true"))
        db.commit()

        logger.info("✅ Initial categories, groups, and budgets seeded.")

    except IntegrityError as e:
        db.rollback()
        logger.warning("⚠️ Skipped seeding — data likely already present.")
        logger.warning(f"Error: {e}")
    finally:
        db.close()


if __name__ == "__main__":
    seed_initial_categories()
