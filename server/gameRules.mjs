export const cardPoints = (card) => {
  if (card.rank === "A" || card.rank === "10") return 10;
  if (card.rank === "5") return 5;
  return 0;
};

export const calculateHandScore = ({ rawPoints, biddingTeam, bid }) => {
  const defendingTeam = biddingTeam === "one" ? "two" : "one";
  const shelem = rawPoints[biddingTeam] === 165;
  const madeBid = rawPoints[biddingTeam] >= bid;
  const scoreDelta = { one: 0, two: 0 };

  if (shelem) {
    scoreDelta[biddingTeam] = 165;
    scoreDelta[defendingTeam] = -165;
  } else {
    scoreDelta[biddingTeam] = madeBid ? rawPoints[biddingTeam] : -bid;
    scoreDelta[defendingTeam] = rawPoints[defendingTeam];
  }

  return {
    bid,
    biddingTeam,
    defendingTeam,
    rawPoints: { ...rawPoints },
    scoreDelta,
    madeBid,
    shelem,
  };
};
