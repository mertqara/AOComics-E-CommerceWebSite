// backend/seed.js
const mongoose = require('mongoose');
const Product = require('./models/Product');
require('dotenv').config({ path: './backend/.env' });

const products = [
  {
    name: "1776 (2025) #1",
    model: "MAR-1776-001",
    serialNumber: "MAR2025001",
    description: "An epic tale of America's founding with Marvel heroes",
    quantityInStock: 50,
    price: 14.99,
    warrantyStatus: "30-day return",
    distributorInfo: "Marvel Comics",
    category: "Marvel",
    imageUrl: "/assets/comic1.png",
    rating: 4.5,
    numReviews: 12
  },
  {
    name: "Captain America (2018)",
    model: "MAR-CA-2018",
    serialNumber: "MAR2018100",
    description: "A new era begins for Captain America",
    quantityInStock: 30,
    price: 12.99,
    warrantyStatus: "30-day return",
    distributorInfo: "Marvel Comics",
    category: "Marvel",
    imageUrl: "/assets/comic2.png",
    rating: 4.8,
    numReviews: 25
  },
  {
    name: "Spider-Man & Wolverine (2025) #6",
    model: "MAR-SW-006",
    serialNumber: "MAR2025006",
    description: "Horror on the train! Two heroes team up",
    quantityInStock: 10,
    price: 13.99,
    warrantyStatus: "30-day return",
    distributorInfo: "Marvel Comics",
    category: "Marvel",
    imageUrl: "assets/comic3.png",
    rating: 4.2,
    numReviews: 8
  },
  {
    name: "ETERNALS (2006) #5",
    model: "MAR-E-005",
    serialNumber: "MAR2006005",
    description: "All the mysteries are answered, as Neil Gaiman (1602, Anansi Boys, Sandman) and John Romita Jr. (AMAZING SPIDER-MEN, WOLVERINE) bring you the penultimate chapter of ETERNALS. The remaining Eternals have to fight for their existence and the nature of the cosmos is explained.",
    quantityInStock: 20,
    price: 3.99,
    warrantyStatus: "30-day return",
    distributorInfo: "Marvel Comics",
    category: "Marvel",
    imageUrl: "/assets/comic4.jpg",
    rating: 0,
    numReviews: 0
  },
  {
    name: "STAR WARS (2015) #73",
    model: "MAR-SW-073",
    serialNumber: "MAR2015073",
    description: "MOMENTS OF TRUTH! Who is DAR CHAMPION and how far can LEIA trust him when HAN'S life is on the line on BOSS CARPO'S golden starship? What shocking lesson will LUKE learn when WARBA finally reveals her true self? And when faced with his lost past, can THREEPIO seize control of his destiny -- and be the hero of his own story? The lives of thousands of rebels hang in the balance as our heroes grapple with their greatest doubts and challenges!",
    quantityInStock: 40,
    price: 14.99,
    warrantyStatus: "30-day return",
    distributorInfo: "Marvel Comics",
    category: "Marvel",
    imageUrl: "/assets/comic5.jpg",
    rating: 0,
    numReviews: 0
  },
  {
    name: "MOON KNIGHT (2014) #7",
    model: "MAR-MK-007",
    serialNumber: "MAR2014007",
    description: "Season 2 of MOON KNIGHT begins with a new creative team and a black-out! When the entire city is thrust into darkness by a threat, Moon Knight?s must use all of his weapons (and personalities) to defeat a new foe! Brian Wood (X-MEN, DMZ) takes the writing reins picking up from where Ellis left off pushing questions from MOON KNIGHT #1 back to the fore and amplifies them 100-fold!",
    quantityInStock: 15,
    price: 12.99,
    warrantyStatus: "30-day return",
    distributorInfo: "Marvel Comics",
    category: "Marvel",
    imageUrl: "/assets/comic6.jpg",
    rating: 0,
    numReviews: 0
  },
  {
    name: "ABSOLUTE BATMAN #14",
    model: "DC-AB-014",
    serialNumber: "DC2025014",
    description: "Batman and Catwoman face down Bane in a final battle! But once the dustsettles, what will it all mean for the future of Batman?",
    quantityInStock: 13,
    price: 4.99,
    warrantyStatus: "30-day return",
    distributorInfo: "DC Comics",
    category: "DC",
    imageUrl: "assets/comic7.jpg",
    rating: 0,
    numReviews: 0
  },
  {
    name: "TEEN TITANS GO! (2025-) #10",
    model: "DC-TTG-010",
    serialNumber: "DC2025010",
    description: "Instead of a white Christmas, or even a blue Christmas, it’s a Rouge Christmas for the Teen Titans! As in Madame Rouge, the shape-shifting villain who wants to make it an unhappy holiday for Beast Boy and his adoptive family, the Doom Patrol.",
    quantityInStock: 5,
    price: 2.99,
    warrantyStatus: "30-day return",
    distributorInfo: "DC Comics",
    category: "DC",
    imageUrl: "assets/comic8.jpg",
    rating: 0,
    numReviews: 0
  },
  {
    name: "BIRDS OF PREY (2023-) #28",
    model: "DC-BOP-028",
    serialNumber: "DC2023028",
    description: "One last mission. One final fight. No do-overs. No second chances. And the fate of the Birds of Prey hangs in the balance. The Unreality is collapsing and threatening all of Gotham as it spills out into the real world in dangerous and unexpected ways. As the Birds of Prey struggle to survive inside the game, the final showdown will test everything the team has built. Can the Birds get to the heart of what the Shadow Army’s real goal has been all along before it’s too late for them…and for Gotham?",
    quantityInStock: 10,
    price: 3.99,
    warrantyStatus: "30-day return",
    distributorInfo: "DC Comics",
    category: "DC",
    imageUrl: "assets/comic9.jpg",
    rating: 0,
    numReviews: 0
  },
  {
    name: "POISON IVY 2025 ANNUAL #1",
    model: "DC-PI-028",
    serialNumber: "DC2025001",
    description: "A tale of times past! No matter what Pamela Isley does, mercy or slaughter, humanity seems dead set on betraying the Earth. Yet Ivy still refuses to let go of her own humanity in service of that which she claims to love. Hoping to discover a way forward, Poison Ivy sets out to find the living repository of all secrets—the Tree of Knowledge. But like those who have tasted the tree’s fruit before her, Ivy learns far more than she bargained for.",
    quantityInStock: 7,
    price: 5.99,
    warrantyStatus: "30-day return",
    distributorInfo: "DC Comics",
    category: "DC",
    imageUrl: "assets/comic10.jpg",
    rating: 0,
    numReviews: 0
  },
  {
    name: "MR. TERRIFIC: YEAR ONE #6",
    model: "DC-MTYO-006",
    serialNumber: "DC2025006",
    description: "Billionaire Athena Prescott was once an ordinary woman of extraordinary wealth, just trying to beat out her fellow titans of tech to the next big advancement in human history—and she was willing to kill to do it. But now her fully powered Nexus Engine has ripped a transdimensional tear in the heart of Gateway City… and granted her a great and terrible new power she can’t control! If Michael Holt hopes to survive, let alone save his city, he’ll have to finally embrace his role as Mr. Terrific…which promises to alter the course of his life forever! Long-buried secrets are unearthed and mysterious forces revealed as Mr. Terrific: Year One hurtles toward its epic conclusion!",
    quantityInStock: 20,
    price: 3.99,
    warrantyStatus: "30-day return",
    distributorInfo: "DC Comics",
    category: "DC",
    imageUrl: "assets/comic11.jpg",
    rating: 0,
    numReviews: 0
  },
  {
    name: "AQUAMAN (2025-) #11",
    model: "DC-A-011",
    serialNumber: "DC2025011",
    description: "Mera and the mystery of Atlantis unravels, even as Andy moves towards her ultimate goal and Arthur contends with the power of the Blue! But is this power too much for even a KING to contend with? An oceanic onslaught unloads on the king of the seven seas, and a the connection between the DARK TIDE and DARKSEID is at last revealed!",
    quantityInStock: 25,
    price: 3.99,
    warrantyStatus: "30-day return",
    distributorInfo: "DC Comics",
    category: "DC",
    imageUrl: "assets/comic12.jpg",
    rating: 0,
    numReviews: 0
  },
  {
    name: "INVINCIBLE #140",
    model: "IC-I-140",
    serialNumber: "IC2017140",
    description: "THE END OF ALL THINGS, Part 8 (of 12) Thragg has done the unthinkable, again, and pushed Mark to his breaking point. Wait...there are FOUR more issues after this one? How?!",
    quantityInStock: 24,
    price: 2.99,
    warrantyStatus: "30-day return",
    distributorInfo: "IMAGE Comics",
    category: "Image",
    imageUrl: "assets/comic13.jpg",
    rating: 0,
    numReviews: 0
  },
  {
    name: "I HATE FAIRYLAND #44",
    model: "IC-IHF-044",
    serialNumber: "IC2025044",
    description: "Years ago, Gert laid waste to the entire land of the Shroomurai...except for one. A daughter of the fallen survived and has vowed to find the Green-Haired Horror and end her life. SKOTTIE YOUNG, DEREK LAUFMAN, and co. continue the new (old) era of I HATE FAIRYLAND with some delicious samurai action!",
    quantityInStock: 10,
    price: 3.99,
    warrantyStatus: "30-day return",
    distributorInfo: "IMAGE Comics",
    category: "Image",
    imageUrl: "assets/comic14.jpg",
    rating: 0,
    numReviews: 0
  },
  {
    name: "FALLING IN LOVE ON THE PATH TO HELL #11",
    model: "IC-FILOTPTH-011",
    serialNumber: "IC2025011",
    description: "The door to leave Purgatory is open, but the gunslinger isn't stepping through without the samurai and that's a problem because she's captured, wounded and at death's door. What bargain will MacRaith be willing to make with the devil to save the woman he loves? Asami makes a shocking discovery that the life growing inside her has upset the natural order in the Land of The Dead she's trapped in. This one has it all: action, romance, heartbreak and all stunningly drawn by GARRY BROWN.",
    quantityInStock: 25,
    price: 3.99,
    warrantyStatus: "30-day return",
    distributorInfo: "IMAGE Comics",
    category: "Image",
    imageUrl: "assets/comic15.jpg",
    rating: 0,
    numReviews: 0
  },
  {
    name: "WITCHBLADE #18",
    model: "IC-W-018",
    serialNumber: "IC2025018",
    description: "The Grinteeth killer is revealed, and the city reels from the burning aftermath of the vigilante's final murder. In the wake of a brutal showdown, Sara confronts the purpose and history of the Witchblade itself - and doesn't like everything she finds. Being a supernatural force for balance is violent business, and the blood on her hands is drawing dangerous attention...",
    quantityInStock: 20,
    price: 3.99,
    warrantyStatus: "30-day return",
    distributorInfo: "IMAGE Comics",
    category: "Image",
    imageUrl: "assets/comic16.jpg",
    rating: 0,
    numReviews: 0
  },
  {
    name: "WITCHBLADE #17",
    model: "IC-W-017",
    serialNumber: "IC2025017",
    description: "The city is on fire as Police sweep into the streets to quell the paranoia and division caused by the vigilante whose targets all have a sinister connection. Sara's close encounter with the supernatural slayer left her wounded and with questions. Meanwhile, the slaughter count is about to rise as the homicidal force of nature has caught another potential victim and taunts Sara to step into the light. Sara is forced to make an impossible choice as the killer’s identity and motivations become clear.",
    quantityInStock: 20,
    price: 3.99,
    warrantyStatus: "30-day return",
    distributorInfo: "IMAGE Comics",
    category: "Image",
    imageUrl: "assets/comic17.jpg",
    rating: 0,
    numReviews: 0
  },
  {
    name: "TRANSFORMERS #23",
    model: "IC-T-023",
    serialNumber: "IC2025023",
    description: "The last hope for the Autobots exists within the Matrix of Leadership. But will the Decepticons triumph before those answers are found?",
    quantityInStock: 20,
    price: 3.99,
    warrantyStatus: "30-day return",
    distributorInfo: "IMAGE Comics",
    category: "Image",
    imageUrl: "assets/comic18.jpg",
    rating: 0,
    numReviews: 0
  },
  {
    name: "YOU'LL DO BAD THINGS #3",
    model: "IC-YDBT-003",
    serialNumber: "IC2025003",
    description: "After coming face to face with the Shape that’s been haunting his nightmares, Seth is treated to an all-you-can-eat buffet at Mistress Bella’s Loose Caboose. Maybe that’ll inspire him to write a happy ending for the woman who accosted him at his book signing… The modern giallo thriller continues here!",
    quantityInStock: 20,
    price: 3.99,
    warrantyStatus: "30-day return",
    distributorInfo: "IMAGE Comics",
    category: "Image",
    imageUrl: "assets/comic19.jpg",
    rating: 0,
    numReviews: 0
  },
    {
    name: "GEIGER #20",
    model: "IC-G-020",
    serialNumber: "IC2024020",
    description: "THE NORTHERNER: DEAD AMERICA, PART 1. After the explosive finale of REDCOAT: THE NORTHERNER, the mysterious Union soldier finds himself face to face with Tariq Geiger in the radioactive future. But is he here to help…or to change everything? The next era of GEIGER begins here.",
    quantityInStock: 20,
    price: 3.99,
    warrantyStatus: "30-day return",
    distributorInfo: "IMAGE Comics",
    category: "Image",
    imageUrl: "assets/comic20.jpg",
    rating: 0,
    numReviews: 0
  },
  
  
];

async function seedDB() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB');
    
    // Clear existing products
    await Product.deleteMany({});
    console.log('Cleared existing products');
    
    // Insert new products
    await Product.insertMany(products);
    console.log('Database seeded with products!');
    
    mongoose.connection.close();
  } catch (error) {
    console.error('Seed error:', error);
    process.exit(1);
  }
}

seedDB();