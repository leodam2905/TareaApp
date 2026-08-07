import 'package:flutter/material.dart';

// Shared service catalog used by both Instant Quote and Post a Job so the two
// flows ask the exact same structured questions. Labels/option values stay in
// English on purpose — they're the semantic input sent to the pricing AI (the
// category chip shown to the user is localised via [nameKey]).

class ServiceCat {
  // `name` (English) is the key into kServiceTasks and part of the AI request.
  // `nameKey` is the categories.* translation key for the displayed chip label.
  final String name, emoji, api, nameKey;
  final Color color;
  const ServiceCat(this.name, this.emoji, this.api, this.color, this.nameKey);
}

const kServiceCats = [
  ServiceCat('Plumbing', '🔧', 'PLUMBING', Color(0xFF38BDF8), 'categories.plumbing'),
  ServiceCat('Electrical', '⚡', 'ELECTRICAL', Color(0xFFF59E0B), 'categories.electrical'),
  ServiceCat('Carpentry', '🪵', 'CARPENTRY', Color(0xFFD97706), 'categories.carpentry'),
  ServiceCat('Painting', '🎨', 'PAINTING', Color(0xFFA78BFA), 'categories.painting'),
  ServiceCat('Cleaning', '✨', 'CLEANING', Color(0xFF34D399), 'categories.cleaning'),
  ServiceCat('Moving', '📦', 'MOVING', Color(0xFFFB923C), 'categories.moving'),
  ServiceCat('General', '🛠️', 'GENERAL', Color(0xFF94A3B8), 'categories.general'),
];

// task label -> list of details {key, label, options}
const Map<String, List<Map<String, dynamic>>> kServiceTasks = {
  'Plumbing': [
    {'label': 'Fix Leaky Faucet', 'details': [
      {'key': 'location', 'label': 'Location', 'options': ['Kitchen', 'Bathroom', 'Outdoor']},
      {'key': 'parts', 'label': 'Parts supplied by', 'options': ['Me', 'Handyman']}]},
    {'label': 'Install Faucet', 'details': [
      {'key': 'location', 'label': 'Location', 'options': ['Kitchen', 'Bathroom']},
      {'key': 'parts', 'label': 'Faucet supplied by', 'options': ['Me', 'Handyman']}]},
    {'label': 'Unclog Drain', 'details': [
      {'key': 'drain', 'label': 'Which drain?', 'options': ['Kitchen sink', 'Bathroom sink', 'Shower / tub', 'Toilet']}]},
    {'label': 'Fix Running Toilet', 'details': [
      {'key': 'issue', 'label': 'Issue', 'options': ['Keeps running', 'Weak flush', 'Leaking at base']}]},
    {'label': 'Install Toilet', 'details': [
      {'key': 'parts', 'label': 'Toilet supplied by', 'options': ['Me', 'Handyman']},
      {'key': 'removal', 'label': 'Remove old toilet?', 'options': ['Yes', 'No']}]},
    {'label': 'Replace Water Heater', 'details': [
      {'key': 'type', 'label': 'Type', 'options': ['Tank (electric)', 'Tank (gas)', 'Tankless']}]},
    {'label': 'Install Garbage Disposal', 'details': [
      {'key': 'parts', 'label': 'Disposal supplied by', 'options': ['Me', 'Handyman']}]},
  ],
  'Electrical': [
    {'label': 'Install Ceiling Fan', 'details': [
      {'key': 'height', 'label': 'Ceiling height', 'options': ['8 ft', '9 ft', '10+ ft', 'Vaulted']},
      {'key': 'preWired', 'label': 'Pre-wired box?', 'options': ['Yes', 'No — needs wiring']},
      {'key': 'fan', 'label': 'Fan supplied by', 'options': ['Me', 'Handyman']}]},
    {'label': 'Replace Outlet', 'details': [
      {'key': 'qty', 'label': 'How many?', 'options': ['1', '2–3', '4+']},
      {'key': 'type', 'label': 'Type', 'options': ['Standard', 'GFCI', 'USB combo']}]},
    {'label': 'Install Light Fixture', 'details': [
      {'key': 'qty', 'label': 'How many?', 'options': ['1', '2–3', '4+']}]},
    {'label': 'Install Smart Switch / Dimmer', 'details': [
      {'key': 'qty', 'label': 'How many?', 'options': ['1', '2–3', '4+']}]},
    {'label': 'Install Smoke / CO Detector', 'details': [
      {'key': 'qty', 'label': 'How many?', 'options': ['1', '2–3', '4+']},
      {'key': 'power', 'label': 'Power', 'options': ['Battery', 'Hardwired']}]},
    {'label': 'Mount Wall TV Outlet', 'details': [
      {'key': 'wall', 'label': 'Wall type', 'options': ['Drywall', 'Concrete / brick']}]},
  ],
  'Carpentry': [
    {'label': 'Assemble Furniture', 'details': [
      {'key': 'pieces', 'label': 'Number of pieces', 'options': ['1', '2–3', '4+']},
      {'key': 'size', 'label': 'Largest piece', 'options': ['Small', 'Medium', 'Large']}]},
    {'label': 'Install Shelving', 'details': [
      {'key': 'shelves', 'label': 'Number of shelves', 'options': ['1–2', '3–5', '6+']}]},
    {'label': 'Repair / Adjust Door', 'details': [
      {'key': 'issue', 'label': 'Issue', 'options': ['Sticks / rubs', 'Won\'t latch', 'Squeaks', 'Replace hinges']}]},
    {'label': 'Install Baseboards / Trim', 'details': [
      {'key': 'length', 'label': 'Approx. length', 'options': ['1 room', '2–3 rooms', 'Whole home']}]},
    {'label': 'Build Custom Shelves', 'details': [
      {'key': 'size', 'label': 'Size', 'options': ['Small', 'Medium', 'Large / built-in']}]},
  ],
  'Painting': [
    {'label': 'Paint a Room', 'details': [
      {'key': 'size', 'label': 'Room size', 'options': ['Small', 'Medium', 'Large']},
      {'key': 'coats', 'label': 'Coats', 'options': ['1 coat', '2 coats']}]},
    {'label': 'Patch & Paint Wall', 'details': [
      {'key': 'patches', 'label': 'Damage level', 'options': ['1–2 small holes', '3–5 holes', 'Large area']}]},
    {'label': 'Paint Cabinets', 'details': [
      {'key': 'count', 'label': 'How many cabinets?', 'options': ['Under 10', '10–20', '20+']}]},
    {'label': 'Stain a Deck', 'details': [
      {'key': 'size', 'label': 'Deck size', 'options': ['Small', 'Medium', 'Large']}]},
    {'label': 'Paint Trim / Doors', 'details': [
      {'key': 'count', 'label': 'How many?', 'options': ['1–3', '4–8', '8+']}]},
  ],
  'Cleaning': [
    {'label': 'Standard Clean', 'details': [
      {'key': 'beds', 'label': 'Bedrooms', 'options': ['Studio / 1BR', '2BR', '3BR', '4BR+']},
      {'key': 'baths', 'label': 'Bathrooms', 'options': ['1', '2', '3+']}]},
    {'label': 'Deep Clean', 'details': [
      {'key': 'beds', 'label': 'Bedrooms', 'options': ['Studio / 1BR', '2BR', '3BR', '4BR+']},
      {'key': 'baths', 'label': 'Bathrooms', 'options': ['1', '2', '3+']}]},
    {'label': 'Move-Out Clean', 'details': [
      {'key': 'beds', 'label': 'Bedrooms', 'options': ['Studio / 1BR', '2BR', '3BR', '4BR+']}]},
    {'label': 'Window Cleaning', 'details': [
      {'key': 'windows', 'label': 'How many windows?', 'options': ['Under 10', '10–20', '20+']}]},
    {'label': 'Carpet Cleaning', 'details': [
      {'key': 'rooms', 'label': 'How many rooms?', 'options': ['1', '2–3', '4+']}]},
  ],
  'Moving': [
    {'label': 'Local Move', 'details': [
      {'key': 'size', 'label': 'Home size', 'options': ['Studio / 1BR', '2BR', '3BR', '4BR+']},
      {'key': 'distance', 'label': 'Distance', 'options': ['< 5 miles', '5–15 miles', '15–30 miles', '30+ miles']}]},
    {'label': 'Load / Unload Truck', 'details': [
      {'key': 'size', 'label': 'Home size', 'options': ['Studio / 1BR', '2BR', '3BR', '4BR+']}]},
    {'label': 'Rearrange Furniture', 'details': [
      {'key': 'pieces', 'label': 'How many pieces?', 'options': ['1–3', '4–8', '8+']}]},
  ],
  'General': [
    {'label': 'TV Mounting', 'details': [
      {'key': 'tvSize', 'label': 'TV size', 'options': ['Under 40"', '40–55"', '55–75"', '75"+']},
      {'key': 'wall', 'label': 'Wall type', 'options': ['Drywall', 'Concrete / brick', 'Tile']}]},
    {'label': 'Picture Hanging', 'details': [
      {'key': 'qty', 'label': 'How many items?', 'options': ['1–2', '3–5', '6+']}]},
    {'label': 'Assembly & Mounting', 'details': [
      {'key': 'item', 'label': 'What to assemble?', 'options': ['TV stand', 'Desk', 'Shelving unit', 'Exercise equipment']}]},
    {'label': 'Gutter Cleaning', 'details': [
      {'key': 'stories', 'label': 'Home height', 'options': ['1 story', '2 story', '3+ story']}]},
    {'label': 'Curtain / Blind Install', 'details': [
      {'key': 'windows', 'label': 'How many windows?', 'options': ['1–2', '3–5', '6+']}]},
    {'label': 'Pressure Washing', 'details': [
      {'key': 'area', 'label': 'What area?', 'options': ['Driveway', 'Patio / deck', 'House siding', 'Fence']}]},
  ],
};
