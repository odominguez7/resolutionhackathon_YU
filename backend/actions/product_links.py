"""
Product recommendation engine -- maps recovery goals to real products.
"""

PRODUCT_DATABASE = {
    "deep_sleep": {
        "goal": "Maximize deep sleep",
        "products": [
            {
                "name": "Blackout Curtain Panel (2-Pack)",
                "brand": "Wayfair Basics",
                "price": "$29.99",
                "why": "Blocks 99% of light -- darkness triggers melatonin production",
                "category_url": "/keyword.php?keyword=blackout+curtains",
            },
            {
                "name": "Cooling Gel Memory Foam Pillow",
                "brand": "Wayfair Sleep",
                "price": "$39.99",
                "why": "Cooling surface lowers head temperature for deeper sleep",
                "category_url": "/keyword.php?keyword=cooling+pillow",
            },
            {
                "name": "White Noise Sound Machine",
                "brand": "LectroFan",
                "price": "$44.99",
                "why": "Consistent sound masking reduces nighttime awakenings",
                "category_url": "/keyword.php?keyword=white+noise+machine",
            },
        ],
        "url": "https://www.wayfair.com/keyword.php?keyword=sleep+accessories",
        "total_estimated": "$114.97",
    },
    "stress_relief": {
        "goal": "Create a stress-free sleep sanctuary",
        "products": [
            {
                "name": "Aromatherapy Essential Oil Diffuser",
                "brand": "InnoGear",
                "price": "$15.99",
                "why": "Lavender reduces cortisol and promotes relaxation",
                "category_url": "/keyword.php?keyword=essential+oil+diffuser",
            },
            {
                "name": "Weighted Blanket (15 lbs)",
                "brand": "Wayfair Sleep",
                "price": "$49.99",
                "why": "Deep pressure stimulation reduces anxiety and stress hormones",
                "category_url": "/keyword.php?keyword=weighted+blanket",
            },
        ],
        "url": "https://www.wayfair.com/keyword.php?keyword=relaxation+bedroom",
        "total_estimated": "$65.98",
    },
    "recovery": {
        "goal": "Optimize recovery environment",
        "products": [
            {
                "name": "Yoga Mat (Extra Thick)",
                "brand": "BalanceFrom",
                "price": "$19.99",
                "why": "Morning stretching improves circulation and reduces muscle tension",
                "category_url": "/keyword.php?keyword=yoga+mat",
            },
            {
                "name": "Sunrise Alarm Clock",
                "brand": "Philips",
                "price": "$34.99",
                "why": "Gradual light mimics natural sunrise for gentle waking",
                "category_url": "/keyword.php?keyword=sunrise+alarm+clock",
            },
        ],
        "url": "https://www.wayfair.com/keyword.php?keyword=wellness+bedroom",
        "total_estimated": "$54.98",
    },
}


def get_product_recommendation(params: dict) -> dict:
    goal = params.get("goal", "deep_sleep")
    return PRODUCT_DATABASE.get(goal, PRODUCT_DATABASE["deep_sleep"])
