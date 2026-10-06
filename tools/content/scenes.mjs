const T = 100;

export const rect = (x, y, w, h) => ({type: "rectangle", x: x * T, y: y * T, width: w * T, height: h * T, rotation: 0, hole: false});

export const scenes = [
  {
    id: "theDrownedFoundry",
    name: "The Drowned Foundry",
    mode: "dungeon",
    fog: false,
    size: [15, 10],
    backgroundColor: "#1d2a2e",
    levels: [
      {id: "floor1", name: "Floor 1, stone", elevation: {bottom: 0, top: 10}, color: "#2a3a3e"},
      {id: "floor2", name: "Floor 2, metal", elevation: {bottom: 10, top: 20}, color: "#3a3230"},
      {id: "floor3", name: "Floor 3, drowned arena", elevation: {bottom: 20, top: 30}, color: "#1f2e3a"}
    ],
    regions: [
      {id: "entryHall", name: "Entry hall", level: "floor1", color: "#7a8c8f", shapes: [rect(0, 0, 5, 10)], terrain: {terrain: "plain", matter: true}},
      {id: "floodedGallery", name: "Flooded gallery", level: "floor1", color: "#4f7f9f", shapes: [rect(5, 0, 5, 10)], terrain: {terrain: "plain", matter: true}},
      {id: "overseersOffice", name: "Overseer's office", level: "floor1", color: "#8c7f6a", shapes: [rect(10, 0, 5, 8)], terrain: {terrain: "plain", matter: true}},
      {id: "stairsDown1", name: "Stairs down to Floor 2", level: "floor1", color: "#d9c36a", shapes: [rect(13, 8, 2, 2)], changeLevel: true},
      {id: "forgeFloor", name: "Forge floor", level: "floor2", color: "#9a6a4a", shapes: [rect(2, 0, 5, 10)], terrain: {terrain: "plain", matter: true}},
      {id: "lockedVault", name: "Locked vault", level: "floor2", color: "#6a6a7a", shapes: [rect(7, 0, 3, 4)], terrain: {terrain: "plain", matter: true}},
      {id: "plagueCorridor", name: "Plague corridor, 4 rounds", level: "floor2", color: "#6a9a4a", shapes: [rect(7, 6, 6, 4)], terrain: {terrain: "plain", matter: false, plagueZone: true}},
      {id: "stairsUp2", name: "Stairs up to Floor 1", level: "floor2", color: "#d9c36a", shapes: [rect(0, 0, 2, 2)], changeLevel: true},
      {id: "stairsDown2", name: "Stairs down to Floor 3", level: "floor2", color: "#d9c36a", shapes: [rect(13, 0, 2, 2)], changeLevel: true},
      {id: "drownedArena", name: "Drowned arena", level: "floor3", color: "#4a6a9a", shapes: [rect(2, 0, 13, 10)], terrain: {terrain: "plain", matter: true}},
      {id: "stairsUp3", name: "Stairs up to Floor 2", level: "floor3", color: "#d9c36a", shapes: [rect(0, 0, 2, 2)], changeLevel: true}
    ]
  },
  {
    id: "fordAtAshfordMill",
    name: "Ford at Ashford Mill",
    mode: "war",
    fog: false,
    size: [24, 20],
    backgroundColor: "#3a4a2e",
    levels: [{id: "ground", name: "Ground", elevation: {bottom: 0, top: 10}, color: "#3a4a2e"}],
    regions: [
      {id: "riverNorth", name: "River", level: "ground", color: "#3f6f9f", shapes: [rect(11, 0, 2, 9)], terrain: {terrain: "river"}},
      {id: "ford", name: "Ford", level: "ground", color: "#8fa0a8", shapes: [rect(11, 9, 2, 2)], terrain: {terrain: "road"}},
      {id: "riverMiddle", name: "River", level: "ground", color: "#3f6f9f", shapes: [rect(11, 11, 2, 3)], terrain: {terrain: "river"}},
      {id: "bridge", name: "Bridge", level: "ground", color: "#a08c6a", shapes: [rect(11, 14, 2, 2)], terrain: {terrain: "road"}},
      {id: "riverSouth", name: "River", level: "ground", color: "#3f6f9f", shapes: [rect(11, 16, 2, 4)], terrain: {terrain: "river"}},
      {id: "hill", name: "Hill, Lathander side", level: "ground", color: "#7a8a4a", shapes: [rect(2, 3, 4, 5)], terrain: {terrain: "hill"}},
      {id: "mill", name: "Ashford Mill", level: "ground", color: "#8c7f6a", shapes: [rect(0, 9, 3, 3)], terrain: {terrain: "fort"}}
    ]
  }
];
