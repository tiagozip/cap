import solver from "@cap.js/solver";

const CHALLENGES = [
  ["e455cea65e98bc3c36287f43769da211", "dceb"],
  ["fb8d25f6abac5aa9b6360051f37e010b", "93f1"],
  ["91ef47db578fbeb2565d3f9c82bb7960", "3698"],
  ["b7ad7667486a691cda8ef297098f64a7", "d72a"],
  ["1aca3fb7cef7a2be0dee563ed4136758", "3b58"],
  ["d9ec39af92b430e5a329274d8aa58fa8", "e1d3"],
  ["781a3cc9217d73c908a321d3fdabd62f", "22c6"],
  ["e37a0752c9ac2f3d2517747fde373ac9", "f6f1"],
  ["bba070197569f322beda5b240f639a95", "4751"],
  ["89297515aeac646bee9653ba405e0beb", "a7de"],
  ["444571a0d5039c15be6141d6cd8434f9", "a783"],
  ["ba75f2bf8e9b92cc32caa17237a52d14", "7e30"],
  ["22bfc18ba8e3ecee080c5d1ef64ed6e9", "5fcf"],
  ["885fb78ff76b4eddd2f5bc04ac5ee673", "93e5"],
  ["308758072931bb3b254a7b1ed351d04a", "3e49"],
  ["724f89bb167db4b881e1dc7b0949ac8f", "b82e"],
  ["8b79506e4630de15be225c18623eff65", "f0e5"],
  ["0c21ade6e63a4e37b13cb8b087f31863", "65c9"],
];

console.log(await solver(CHALLENGES));
