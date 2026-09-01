export const TRAVELERS = [
  { id: "daekyeom", name: "정대겸" },
  { id: "gyuyeol", name: "이규열" },
  { id: "junsu", name: "박준수" },
  { id: "gyujun", name: "한규준" },
] as const;

export type TravelerId = typeof TRAVELERS[number]["id"];
export type PublicTraveler = typeof TRAVELERS[number];
