// The guided question set behind Post a Job and Instant Quote.
//
// Ported from apps/mobile-flutter/lib/service_catalog.dart, which was the only
// copy — so the guided flow existed on mobile and the website had a free-text
// box with an "improve this" button. Same 13 categories, 69 tasks and 85
// questions; verified against the Dart source at port time.
//
// Labels and option values stay in ENGLISH on purpose. They are the semantic
// input to the pricing model, not display strings — the category chip a
// customer sees is translated separately via nameKey. Translating these would
// change what the model is asked.
//
// Served at /api/service-catalog so both front ends can read one source. The
// Dart copy still exists and will drift; folding it onto this endpoint needs an
// app build, which is why it has not happened yet.

export interface CatalogQuestion {
  key: string;
  label: string;
  options: string[];
}

export interface CatalogTask {
  label: string;
  details: CatalogQuestion[];
}

export interface CatalogCategory {
  /** English name, and the key into TASKS. Part of the AI request. */
  name: string;
  /** ServiceCategory enum value stored on the booking. */
  api: string;
  color: string;
  /** categories.* translation key for the label shown to a customer. */
  nameKey: string;
}

export const SERVICE_CATEGORIES: CatalogCategory[] = [
  {
    "name": "Plumbing",
    "api": "PLUMBING",
    "color": "#38BDF8",
    "nameKey": "categories.plumbing"
  },
  {
    "name": "Electrical",
    "api": "ELECTRICAL",
    "color": "#F59E0B",
    "nameKey": "categories.electrical"
  },
  {
    "name": "Carpentry",
    "api": "CARPENTRY",
    "color": "#D97706",
    "nameKey": "categories.carpentry"
  },
  {
    "name": "Painting",
    "api": "PAINTING",
    "color": "#A78BFA",
    "nameKey": "categories.painting"
  },
  {
    "name": "Cleaning",
    "api": "CLEANING",
    "color": "#34D399",
    "nameKey": "categories.cleaning"
  },
  {
    "name": "Moving",
    "api": "MOVING",
    "color": "#FB923C",
    "nameKey": "categories.moving"
  },
  {
    "name": "Assembly",
    "api": "GENERAL",
    "color": "#8B5CF6",
    "nameKey": "categories.assembly"
  },
  {
    "name": "HVAC",
    "api": "HVAC",
    "color": "#22D3EE",
    "nameKey": "categories.hvac"
  },
  {
    "name": "Roofing",
    "api": "ROOFING",
    "color": "#EF4444",
    "nameKey": "categories.roofing"
  },
  {
    "name": "Landscaping",
    "api": "LANDSCAPING",
    "color": "#22C55E",
    "nameKey": "categories.landscaping"
  },
  {
    "name": "Appliance Repair",
    "api": "APPLIANCE_REPAIR",
    "color": "#64748B",
    "nameKey": "categories.appliance"
  },
  {
    "name": "Laundry",
    "api": "LAUNDRY",
    "color": "#14B8A6",
    "nameKey": "categories.laundry"
  },
  {
    "name": "General",
    "api": "GENERAL",
    "color": "#94A3B8",
    "nameKey": "categories.general"
  }
];

export const SERVICE_TASKS: Record<string, CatalogTask[]> = {
  "Plumbing": [
    {
      "label": "Fix Leaky Faucet",
      "details": [
        {
          "key": "location",
          "label": "Location",
          "options": [
            "Kitchen",
            "Bathroom",
            "Outdoor"
          ]
        },
        {
          "key": "parts",
          "label": "Parts supplied by",
          "options": [
            "Me",
            "Handyman"
          ]
        }
      ]
    },
    {
      "label": "Install Faucet",
      "details": [
        {
          "key": "location",
          "label": "Location",
          "options": [
            "Kitchen",
            "Bathroom"
          ]
        },
        {
          "key": "parts",
          "label": "Faucet supplied by",
          "options": [
            "Me",
            "Handyman"
          ]
        }
      ]
    },
    {
      "label": "Unclog Drain",
      "details": [
        {
          "key": "drain",
          "label": "Which drain?",
          "options": [
            "Kitchen sink",
            "Bathroom sink",
            "Shower / tub",
            "Toilet"
          ]
        }
      ]
    },
    {
      "label": "Fix Running Toilet",
      "details": [
        {
          "key": "issue",
          "label": "Issue",
          "options": [
            "Keeps running",
            "Weak flush",
            "Leaking at base"
          ]
        }
      ]
    },
    {
      "label": "Install Toilet",
      "details": [
        {
          "key": "parts",
          "label": "Toilet supplied by",
          "options": [
            "Me",
            "Handyman"
          ]
        },
        {
          "key": "removal",
          "label": "Remove old toilet?",
          "options": [
            "Yes",
            "No"
          ]
        }
      ]
    },
    {
      "label": "Replace Water Heater",
      "details": [
        {
          "key": "type",
          "label": "Type",
          "options": [
            "Tank (electric)",
            "Tank (gas)",
            "Tankless"
          ]
        }
      ]
    },
    {
      "label": "Install Garbage Disposal",
      "details": [
        {
          "key": "parts",
          "label": "Disposal supplied by",
          "options": [
            "Me",
            "Handyman"
          ]
        }
      ]
    }
  ],
  "Electrical": [
    {
      "label": "Install Ceiling Fan",
      "details": [
        {
          "key": "height",
          "label": "Ceiling height",
          "options": [
            "8 ft",
            "9 ft",
            "10+ ft",
            "Vaulted"
          ]
        },
        {
          "key": "preWired",
          "label": "Pre-wired box?",
          "options": [
            "Yes",
            "No \u2014 needs wiring"
          ]
        },
        {
          "key": "fan",
          "label": "Fan supplied by",
          "options": [
            "Me",
            "Handyman"
          ]
        }
      ]
    },
    {
      "label": "Replace Outlet",
      "details": [
        {
          "key": "qty",
          "label": "How many?",
          "options": [
            "1",
            "2\u20133",
            "4+"
          ]
        },
        {
          "key": "type",
          "label": "Type",
          "options": [
            "Standard",
            "GFCI",
            "USB combo"
          ]
        }
      ]
    },
    {
      "label": "Install Light Fixture",
      "details": [
        {
          "key": "qty",
          "label": "How many?",
          "options": [
            "1",
            "2\u20133",
            "4+"
          ]
        }
      ]
    },
    {
      "label": "Install Smart Switch / Dimmer",
      "details": [
        {
          "key": "qty",
          "label": "How many?",
          "options": [
            "1",
            "2\u20133",
            "4+"
          ]
        }
      ]
    },
    {
      "label": "Install Smoke / CO Detector",
      "details": [
        {
          "key": "qty",
          "label": "How many?",
          "options": [
            "1",
            "2\u20133",
            "4+"
          ]
        },
        {
          "key": "power",
          "label": "Power",
          "options": [
            "Battery",
            "Hardwired"
          ]
        }
      ]
    },
    {
      "label": "Mount Wall TV Outlet",
      "details": [
        {
          "key": "wall",
          "label": "Wall type",
          "options": [
            "Drywall",
            "Concrete / brick"
          ]
        }
      ]
    }
  ],
  "Carpentry": [
    {
      "label": "Assemble Furniture",
      "details": [
        {
          "key": "pieces",
          "label": "Number of pieces",
          "options": [
            "1",
            "2\u20133",
            "4+"
          ]
        },
        {
          "key": "size",
          "label": "Largest piece",
          "options": [
            "Small",
            "Medium",
            "Large"
          ]
        }
      ]
    },
    {
      "label": "Install Shelving",
      "details": [
        {
          "key": "shelves",
          "label": "Number of shelves",
          "options": [
            "1\u20132",
            "3\u20135",
            "6+"
          ]
        }
      ]
    },
    {
      "label": "Repair / Adjust Door",
      "details": [
        {
          "key": "issue",
          "label": "Issue",
          "options": [
            "Sticks / rubs",
            "Won\\",
            ", ",
            ", "
          ]
        }
      ]
    },
    {
      "label": "Install Baseboards / Trim",
      "details": [
        {
          "key": "length",
          "label": "Approx. length",
          "options": [
            "1 room",
            "2\u20133 rooms",
            "Whole home"
          ]
        }
      ]
    },
    {
      "label": "Build Custom Shelves",
      "details": [
        {
          "key": "size",
          "label": "Size",
          "options": [
            "Small",
            "Medium",
            "Large / built-in"
          ]
        }
      ]
    }
  ],
  "Painting": [
    {
      "label": "Paint a Room",
      "details": [
        {
          "key": "size",
          "label": "Room size",
          "options": [
            "Small",
            "Medium",
            "Large"
          ]
        },
        {
          "key": "coats",
          "label": "Coats",
          "options": [
            "1 coat",
            "2 coats"
          ]
        }
      ]
    },
    {
      "label": "Patch & Paint Wall",
      "details": [
        {
          "key": "patches",
          "label": "Damage level",
          "options": [
            "1\u20132 small holes",
            "3\u20135 holes",
            "Large area"
          ]
        }
      ]
    },
    {
      "label": "Paint Cabinets",
      "details": [
        {
          "key": "count",
          "label": "How many cabinets?",
          "options": [
            "Under 10",
            "10\u201320",
            "20+"
          ]
        }
      ]
    },
    {
      "label": "Stain a Deck",
      "details": [
        {
          "key": "size",
          "label": "Deck size",
          "options": [
            "Small",
            "Medium",
            "Large"
          ]
        }
      ]
    },
    {
      "label": "Paint Trim / Doors",
      "details": [
        {
          "key": "count",
          "label": "How many?",
          "options": [
            "1\u20133",
            "4\u20138",
            "8+"
          ]
        }
      ]
    }
  ],
  "Cleaning": [
    {
      "label": "Standard Clean",
      "details": [
        {
          "key": "beds",
          "label": "Bedrooms",
          "options": [
            "Studio / 1BR",
            "2BR",
            "3BR",
            "4BR+"
          ]
        },
        {
          "key": "baths",
          "label": "Bathrooms",
          "options": [
            "1",
            "2",
            "3+"
          ]
        }
      ]
    },
    {
      "label": "Deep Clean",
      "details": [
        {
          "key": "beds",
          "label": "Bedrooms",
          "options": [
            "Studio / 1BR",
            "2BR",
            "3BR",
            "4BR+"
          ]
        },
        {
          "key": "baths",
          "label": "Bathrooms",
          "options": [
            "1",
            "2",
            "3+"
          ]
        }
      ]
    },
    {
      "label": "Move-Out Clean",
      "details": [
        {
          "key": "beds",
          "label": "Bedrooms",
          "options": [
            "Studio / 1BR",
            "2BR",
            "3BR",
            "4BR+"
          ]
        }
      ]
    },
    {
      "label": "Window Cleaning",
      "details": [
        {
          "key": "windows",
          "label": "How many windows?",
          "options": [
            "Under 10",
            "10\u201320",
            "20+"
          ]
        }
      ]
    },
    {
      "label": "Carpet Cleaning",
      "details": [
        {
          "key": "rooms",
          "label": "How many rooms?",
          "options": [
            "1",
            "2\u20133",
            "4+"
          ]
        }
      ]
    }
  ],
  "Moving": [
    {
      "label": "Local Move",
      "details": [
        {
          "key": "size",
          "label": "Home size",
          "options": [
            "Studio / 1BR",
            "2BR",
            "3BR",
            "4BR+"
          ]
        },
        {
          "key": "distance",
          "label": "Distance",
          "options": [
            "< 5 miles",
            "5\u201315 miles",
            "15\u201330 miles",
            "30+ miles"
          ]
        }
      ]
    },
    {
      "label": "Load / Unload Truck",
      "details": [
        {
          "key": "size",
          "label": "Home size",
          "options": [
            "Studio / 1BR",
            "2BR",
            "3BR",
            "4BR+"
          ]
        }
      ]
    },
    {
      "label": "Rearrange Furniture",
      "details": [
        {
          "key": "pieces",
          "label": "How many pieces?",
          "options": [
            "1\u20133",
            "4\u20138",
            "8+"
          ]
        }
      ]
    }
  ],
  "Assembly": [
    {
      "label": "Assemble Furniture",
      "details": [
        {
          "key": "pieces",
          "label": "Number of pieces",
          "options": [
            "1",
            "2\u20133",
            "4+"
          ]
        },
        {
          "key": "size",
          "label": "Largest piece",
          "options": [
            "Small",
            "Medium",
            "Large"
          ]
        }
      ]
    },
    {
      "label": "Mount TV",
      "details": [
        {
          "key": "tvSize",
          "label": "TV size",
          "options": [
            "Under 40\"",
            "40\u201355\"",
            "55\u201375\"",
            "75\"+"
          ]
        },
        {
          "key": "wall",
          "label": "Wall type",
          "options": [
            "Drywall",
            "Concrete / brick",
            "Tile"
          ]
        }
      ]
    },
    {
      "label": "Assemble Exercise Equipment",
      "details": [
        {
          "key": "size",
          "label": "Size",
          "options": [
            "Small",
            "Medium",
            "Large / multi-station"
          ]
        }
      ]
    },
    {
      "label": "Assemble Playset / Trampoline",
      "details": [
        {
          "key": "size",
          "label": "Size",
          "options": [
            "Small",
            "Medium",
            "Large"
          ]
        }
      ]
    },
    {
      "label": "Mount Shelves / Cabinets",
      "details": [
        {
          "key": "qty",
          "label": "How many?",
          "options": [
            "1\u20132",
            "3\u20135",
            "6+"
          ]
        },
        {
          "key": "wall",
          "label": "Wall type",
          "options": [
            "Drywall",
            "Concrete / brick",
            "Tile"
          ]
        }
      ]
    }
  ],
  "HVAC": [
    {
      "label": "Service AC Unit",
      "details": [
        {
          "key": "issue",
          "label": "Issue",
          "options": [
            "Not cooling",
            "Weak airflow",
            "Making noise",
            "Routine tune-up"
          ]
        }
      ]
    },
    {
      "label": "Repair Furnace / Heating",
      "details": [
        {
          "key": "issue",
          "label": "Issue",
          "options": [
            "No heat",
            "Weak heat",
            "Strange noise",
            "Routine tune-up"
          ]
        }
      ]
    },
    {
      "label": "Install Thermostat",
      "details": [
        {
          "key": "type",
          "label": "Type",
          "options": [
            "Standard",
            "Programmable",
            "Smart"
          ]
        }
      ]
    },
    {
      "label": "Install Window AC",
      "details": [
        {
          "key": "size",
          "label": "Unit size",
          "options": [
            "Small",
            "Medium",
            "Large"
          ]
        }
      ]
    },
    {
      "label": "Clean Ducts / Vents",
      "details": [
        {
          "key": "vents",
          "label": "How many vents?",
          "options": [
            "Under 5",
            "5\u201310",
            "10+"
          ]
        }
      ]
    },
    {
      "label": "Replace Air Filter",
      "details": [
        {
          "key": "qty",
          "label": "How many?",
          "options": [
            "1",
            "2\u20133",
            "4+"
          ]
        }
      ]
    }
  ],
  "Roofing": [
    {
      "label": "Fix Roof Leak",
      "details": [
        {
          "key": "roof",
          "label": "Roof type",
          "options": [
            "Shingle",
            "Metal",
            "Flat",
            "Tile"
          ]
        }
      ]
    },
    {
      "label": "Replace Shingles",
      "details": [
        {
          "key": "area",
          "label": "Area",
          "options": [
            "A few shingles",
            "Small section",
            "Large section"
          ]
        }
      ]
    },
    {
      "label": "Repair Flashing",
      "details": [
        {
          "key": "location",
          "label": "Location",
          "options": [
            "Chimney",
            "Vent",
            "Skylight",
            "Valley"
          ]
        }
      ]
    },
    {
      "label": "Clean Gutters",
      "details": [
        {
          "key": "stories",
          "label": "Home height",
          "options": [
            "1 story",
            "2 story",
            "3+ story"
          ]
        }
      ]
    },
    {
      "label": "Roof Inspection",
      "details": [
        {
          "key": "stories",
          "label": "Home height",
          "options": [
            "1 story",
            "2 story",
            "3+ story"
          ]
        }
      ]
    }
  ],
  "Landscaping": [
    {
      "label": "Lawn Mowing",
      "details": [
        {
          "key": "size",
          "label": "Yard size",
          "options": [
            "Small",
            "Medium",
            "Large"
          ]
        }
      ]
    },
    {
      "label": "Tree / Shrub Trimming",
      "details": [
        {
          "key": "count",
          "label": "How many?",
          "options": [
            "1\u20132",
            "3\u20135",
            "6+"
          ]
        }
      ]
    },
    {
      "label": "Yard Cleanup",
      "details": [
        {
          "key": "size",
          "label": "Yard size",
          "options": [
            "Small",
            "Medium",
            "Large"
          ]
        }
      ]
    },
    {
      "label": "Mulching / Planting",
      "details": [
        {
          "key": "area",
          "label": "Area",
          "options": [
            "Small bed",
            "Medium",
            "Large"
          ]
        }
      ]
    },
    {
      "label": "Leaf Removal",
      "details": [
        {
          "key": "size",
          "label": "Yard size",
          "options": [
            "Small",
            "Medium",
            "Large"
          ]
        }
      ]
    },
    {
      "label": "Sod / Seeding",
      "details": [
        {
          "key": "area",
          "label": "Area",
          "options": [
            "Small",
            "Medium",
            "Large"
          ]
        }
      ]
    }
  ],
  "Appliance Repair": [
    {
      "label": "Repair Refrigerator",
      "details": [
        {
          "key": "issue",
          "label": "Issue",
          "options": [
            "Not cooling",
            "Leaking",
            "Noisy",
            "Ice maker"
          ]
        }
      ]
    },
    {
      "label": "Repair Washer",
      "details": [
        {
          "key": "issue",
          "label": "Issue",
          "options": [
            "t drain\", \"Won",
            "Leaking"
          ]
        }
      ]
    },
    {
      "label": "Repair Dryer",
      "details": [
        {
          "key": "issue",
          "label": "Issue",
          "options": [
            "No heat",
            "t tumble\", ",
            ", "
          ]
        }
      ]
    },
    {
      "label": "Repair Dishwasher",
      "details": [
        {
          "key": "issue",
          "label": "Issue",
          "options": [
            "Not cleaning",
            "Leaking",
            "t drain\", \"Won"
          ]
        }
      ]
    },
    {
      "label": "Repair Oven / Stove",
      "details": [
        {
          "key": "type",
          "label": "Type",
          "options": [
            "Electric",
            "Gas"
          ]
        },
        {
          "key": "issue",
          "label": "Issue",
          "options": [
            "Not heating",
            "Uneven heat",
            "Burner out"
          ]
        }
      ]
    },
    {
      "label": "Install Appliance",
      "details": [
        {
          "key": "appliance",
          "label": "Which appliance?",
          "options": [
            "Dishwasher",
            "Washer",
            "Dryer",
            "Range",
            "Microwave"
          ]
        }
      ]
    }
  ],
  "Laundry": [
    {
      "label": "Wash & Fold",
      "details": [
        {
          "key": "load",
          "label": "How much?",
          "options": [
            "1 load",
            "2\u20133 loads",
            "4+ loads"
          ]
        }
      ]
    },
    {
      "label": "Ironing",
      "details": [
        {
          "key": "items",
          "label": "How many items?",
          "options": [
            "Under 10",
            "10\u201320",
            "20+"
          ]
        }
      ]
    },
    {
      "label": "Pickup & Delivery",
      "details": [
        {
          "key": "load",
          "label": "How much?",
          "options": [
            "Small",
            "Medium",
            "Large"
          ]
        }
      ]
    }
  ],
  "General": [
    {
      "label": "TV Mounting",
      "details": [
        {
          "key": "tvSize",
          "label": "TV size",
          "options": [
            "Under 40\"",
            "40\u201355\"",
            "55\u201375\"",
            "75\"+"
          ]
        },
        {
          "key": "wall",
          "label": "Wall type",
          "options": [
            "Drywall",
            "Concrete / brick",
            "Tile"
          ]
        }
      ]
    },
    {
      "label": "Picture Hanging",
      "details": [
        {
          "key": "qty",
          "label": "How many items?",
          "options": [
            "1\u20132",
            "3\u20135",
            "6+"
          ]
        }
      ]
    },
    {
      "label": "Assembly & Mounting",
      "details": [
        {
          "key": "item",
          "label": "What to assemble?",
          "options": [
            "TV stand",
            "Desk",
            "Shelving unit",
            "Exercise equipment"
          ]
        }
      ]
    },
    {
      "label": "Gutter Cleaning",
      "details": [
        {
          "key": "stories",
          "label": "Home height",
          "options": [
            "1 story",
            "2 story",
            "3+ story"
          ]
        }
      ]
    },
    {
      "label": "Curtain / Blind Install",
      "details": [
        {
          "key": "windows",
          "label": "How many windows?",
          "options": [
            "1\u20132",
            "3\u20135",
            "6+"
          ]
        }
      ]
    },
    {
      "label": "Pressure Washing",
      "details": [
        {
          "key": "area",
          "label": "What area?",
          "options": [
            "Driveway",
            "Patio / deck",
            "House siding",
            "Fence"
          ]
        }
      ]
    },
    {
      "label": "Something else",
      "details": []
    }
  ]
};

/** Tasks for a category, by its English name. */
export const tasksFor = (categoryName: string): CatalogTask[] => SERVICE_TASKS[categoryName] ?? [];

/** The English category name for a stored enum value, e.g. PLUMBING -> Plumbing. */
export const categoryNameFor = (api: string): string | undefined =>
  SERVICE_CATEGORIES.find((c) => c.api === api)?.name;
