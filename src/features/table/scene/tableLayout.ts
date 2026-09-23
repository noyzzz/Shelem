import type { Card } from "@/domain/types";
import type { TableViewModel } from "@/features/table/model/tableTypes";
import {
  SEAT_ANCHORS,
  TABLE_SURFACE_Y,
} from "@/features/table/scene/tableConfig";
import { Euler, MathUtils, Quaternion, Vector3 } from "three";

export type SceneCardTarget = {
  opacity: number;
  position: Vector3;
  quaternion: Quaternion;
  scale: number;
};

export type DesiredCard = {
  card?: Card;
  enabled: boolean;
  faceDown: boolean;
  id: string;
  selected: boolean;
  spawn: Vector3;
  target: SceneCardTarget;
};

const faceUp = (rotation: Euler) => new Quaternion().setFromEuler(rotation);

const LOCAL_HAND_TILT = -0.92;
const LOCAL_HAND_STACK_GAP = 0.03;
const LOCAL_HAND_NORMAL = new Vector3(
  0,
  -Math.sin(LOCAL_HAND_TILT),
  Math.cos(LOCAL_HAND_TILT),
);
const LOCAL_HAND_SURFACE_UP = new Vector3(
  0,
  Math.cos(LOCAL_HAND_TILT),
  Math.sin(LOCAL_HAND_TILT),
);

export function buildDesiredCards(model: TableViewModel): DesiredCard[] {
  return [
    ...layoutLocalHand(model),
    ...layoutGround(model),
    ...layoutCurrentTrick(model),
    ...layoutOpponentHands(model),
    ...layoutTableDeck(model),
  ];
}

function layoutLocalHand(model: TableViewModel): DesiredCard[] {
  const handCount = model.hand.length;
  const handStep =
    handCount <= 1 ? 0 : Math.min(0.58, 6.1 / Math.max(1, handCount - 1));
  const handStart = -((handCount - 1) * handStep) / 2;

  return model.hand.map((view, index) => {
    const distance = index - (handCount - 1) / 2;
    const fanDrop = Math.abs(distance) * 0.013;
    const stackDepth = view.selected
      ? (handCount + 2) * LOCAL_HAND_STACK_GAP
      : index * LOCAL_HAND_STACK_GAP;
    const position = new Vector3(handStart + index * handStep, 1.05, 3.55)
      .addScaledVector(LOCAL_HAND_SURFACE_UP, -fanDrop)
      .addScaledVector(LOCAL_HAND_NORMAL, stackDepth);

    return {
      card: view.card,
      enabled: view.enabled,
      faceDown: false,
      id: view.card.id,
      selected: view.selected,
      spawn: new Vector3(0, 1.1, 0),
      target: {
        opacity: view.enabled || model.phase !== "playing" ? 1 : 0.58,
        position,
        quaternion: faceUp(
          new Euler(LOCAL_HAND_TILT, 0, MathUtils.degToRad(-distance * 2.2)),
        ),
        scale: view.selected ? 1.14 : 1,
      },
    };
  });
}

function layoutGround(model: TableViewModel): DesiredCard[] {
  return model.groundCards.map((card, index) => ({
    card,
    enabled: false,
    faceDown: false,
    id: card.id,
    selected: false,
    spawn: new Vector3(0, TABLE_SURFACE_Y + 0.1, 0),
    target: {
      opacity: 1,
      position: new Vector3(
        (index - 1.5) * 0.52,
        TABLE_SURFACE_Y + index * 0.008,
        0,
      ),
      quaternion: faceUp(
        new Euler(-Math.PI / 2, 0, MathUtils.degToRad((index - 1.5) * 5)),
      ),
      scale: 0.9,
    },
  }));
}

function layoutCurrentTrick(model: TableViewModel): DesiredCard[] {
  const positions = {
    north: new Vector3(0, TABLE_SURFACE_Y + 0.12, -0.78),
    south: new Vector3(0, TABLE_SURFACE_Y + 0.15, 0.78),
    west: new Vector3(-1.05, TABLE_SURFACE_Y + 0.18, 0),
    east: new Vector3(1.05, TABLE_SURFACE_Y + 0.21, 0),
  };

  return model.trick.map((played) => ({
    card: played.card,
    enabled: false,
    faceDown: false,
    id: played.card.id,
    selected: false,
    spawn: SEAT_ANCHORS[played.displayPosition].clone(),
    target: {
      opacity: 1,
      position: positions[played.displayPosition],
      quaternion: faceUp(
        new Euler(
          -Math.PI / 2,
          0,
          MathUtils.degToRad(
            played.displayPosition === "west"
              ? -8
              : played.displayPosition === "east"
                ? 8
                : 0,
          ),
        ),
      ),
      scale: 0.92,
    },
  }));
}

function layoutOpponentHands(model: TableViewModel): DesiredCard[] {
  const cards: DesiredCard[] = [];
  model.seats.forEach((seat) => {
    if (
      !seat.player ||
      seat.displayPosition === "south" ||
      seat.handCount === 0
    ) {
      return;
    }

    const shown = Math.min(seat.handCount, 12);
    for (let index = 0; index < shown; index += 1) {
      const spread = (index - (shown - 1) / 2) * 0.12;
      let position: Vector3;
      let rotation: Euler;
      if (seat.displayPosition === "north") {
        position = new Vector3(
          spread,
          TABLE_SURFACE_Y + 0.1 + index * 0.003,
          -2.7,
        );
        rotation = new Euler(-Math.PI / 2, 0, MathUtils.degToRad(spread * 18));
      } else if (seat.displayPosition === "west") {
        position = new Vector3(
          -4.15,
          TABLE_SURFACE_Y + 0.1 + index * 0.003,
          spread,
        );
        rotation = new Euler(-Math.PI / 2, 0, Math.PI / 2);
      } else {
        position = new Vector3(
          4.15,
          TABLE_SURFACE_Y + 0.1 + index * 0.003,
          spread,
        );
        rotation = new Euler(-Math.PI / 2, 0, -Math.PI / 2);
      }

      cards.push({
        enabled: false,
        faceDown: true,
        id: `opponent:${seat.player.id}:${index}`,
        selected: false,
        spawn: SEAT_ANCHORS[seat.displayPosition].clone(),
        target: {
          opacity: 1,
          position,
          quaternion: faceUp(rotation),
          scale: 0.62,
        },
      });
    }
  });
  return cards;
}

function layoutTableDeck(model: TableViewModel): DesiredCard[] {
  const needsGroundBacks =
    model.phase !== "lobby" &&
    model.groundCount > 0 &&
    model.groundCards.length === 0 &&
    model.trick.length === 0;
  const deckCount = model.phase === "lobby" ? 3 : needsGroundBacks ? 4 : 0;
  const cards: DesiredCard[] = [];

  for (let index = 0; index < deckCount; index += 1) {
    cards.push({
      enabled: false,
      faceDown: true,
      id: `table-deck:${index}`,
      selected: false,
      spawn: new Vector3(0, TABLE_SURFACE_Y, 0),
      target: {
        opacity: 1,
        position: new Vector3(
          (index - (deckCount - 1) / 2) * (needsGroundBacks ? 0.48 : 0.025),
          TABLE_SURFACE_Y + 0.09 + index * 0.015,
          0,
        ),
        quaternion: faceUp(
          new Euler(-Math.PI / 2, 0, MathUtils.degToRad((index - 1.5) * 3)),
        ),
        scale: needsGroundBacks ? 0.82 : 0.9,
      },
    });
  }
  return cards;
}
