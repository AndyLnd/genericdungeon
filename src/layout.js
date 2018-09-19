import { rand, randFromArray } from './util';
import { Room } from './room';
import { Rect } from './rect';
import aStar from './astar';

export class Layout {
  constructor(roomCount, debugString) {
    this.tileSize = 16;
    this.roomShouldMove = this.roomShouldMove.bind(this);

    if (debugString) {
      const debugRooms = debugString
        .match(/.{8}/g)
        .map(group => group.match(/.{2}/g).map(number => parseInt(number, 16)));
      this.rooms = debugRooms.map(([x, y, w, h]) => new Room(x, y, w, h));
    } else {
      this.rooms = this.makeRooms(roomCount);
    }

    this.fixLayout();

    this.setValidNeighbors();

    this.startRoom = this.getMostCenterRoom();

    this.rooms = this.getConnectedRooms(this.startRoom);
    this.normalizeCoords();
    console.log(
      this.rooms
        .map(({ x, y, w, h }) =>
          `00000000${((x << 24) | (y << 16) | (w << 8) | h).toString(
            16,
          )}`.substr(-8),
        )
        .join(''),
    );
    this.endRoom = this.rooms[this.rooms.length - 1];
    this.map = this.makeMap();
    this.doors = this.makeDoors();
    this.startPos = this.startRoom.getCenter(true);
    this.endPos = this.endRoom.getCenter(true);
    this.makeGoalPath(this.startPos);
  }

  makeGoalPath(from) {
    this.goalPath = aStar(from, this.endPos, this.map);
  }

  makeRooms(count) {
    const makeRoom = () =>
      new Room(rand(20, 30), rand(20, 30), rand(4, 9), rand(4, 9));
    return Array.from({length: count}, makeRoom);
  }

  getConnectedRooms(startRoom) {
    const connectedRooms = [startRoom];
    const addConnected = room =>
      !connectedRooms.includes(room) && connectedRooms.push(room);
    let roomsToCheck = startRoom.neighbors.slice();
    while (roomsToCheck.length) {
      const newRoomsToCheck = [];
      roomsToCheck.forEach(room => {
        addConnected(room);
        room.neighbors.forEach(
          neighbor =>
            !connectedRooms.includes(neighbor) &&
            newRoomsToCheck.push(neighbor),
        );
      });
      roomsToCheck = newRoomsToCheck;
    }
    return connectedRooms;
  }

  createDists(startRoom) {
    const unvisited = this.rooms.slice();
    while (unvisited.length) {
      const room = unvisited.reduce(
        (shortest, curr) => (curr.dist < shortest.dist ? curr : shortest),
        unvisited[0],
      );
      unvisited.splice(unvisited.indexOf(room), 1);
      room.neighbors.forEach(neighbor => {
        const dist = room.dist + room.getCenterDist(neighbor);
        if (dist < neighbor.dist) {
          neighbor.dist = dist;
        }
      });
    }
  }

  getRoomAtPosition(x, y) {
    return this.rooms.find(
      room => x > room.x && x < room.x2 && y > room.y && y < room.y2,
    );
  }

  normalizeCoords() {
    const { x, y } = Rect.fromRects(this.rooms);
    this.rooms.forEach(room => room.move(-x, -y));
  }

  getMostCenterRoom() {
    const allBounds = Rect.fromRects(this.rooms);
    return this.rooms.reduce(
      (closest, room) => {
        const dist = room.getCenterDist(allBounds);
        return dist < closest.dist ? { room, dist } : closest;
      },
      { room: this.rooms[0], dist: Infinity },
    ).room;
  }

  getOtherRooms(room) {
    return this.rooms.filter(oRoom => room !== oRoom);
  }

  roomShouldMove(room) {
    return this.getOtherRooms(room).some(oRoom => room.isOverlapping(oRoom));
  }

  setValidNeighbors() {
    this.rooms.forEach(room =>
      room.findAndSetNeighbors(this.getOtherRooms(room)),
    );
  }

  fixLayout(maxSteps = 100000) {
    let steps = 0;
    while (steps++ < maxSteps && this.rooms.some(this.roomShouldMove)) {
      this.fixLayoutStep();
    }
  }

  fixLayoutStep() {
    const movableRooms = this.rooms.filter(this.roomShouldMove);
    const randomRoom = randFromArray(movableRooms);

    const otherRooms = movableRooms.filter(
      room => room !== randomRoom && randomRoom.isOverlapping(room),
    );
    const otherRoom = randFromArray(otherRooms);

    const otherCenter = otherRoom.getCenter();
    const roomCenter = randomRoom.getCenter();

    const diffX = roomCenter.x - otherCenter.x;
    const diffY = roomCenter.y - otherCenter.y;
    const absDiffX = Math.abs(diffX);
    const absDiffY = Math.abs(diffY);

    const moveAlongX =
      absDiffX > absDiffY
        ? true
        : absDiffX < absDiffY
          ? false
          : Math.random() > 0.5;

    const moveX = Math.sign(diffX);
    const moveY = Math.sign(diffY);

    randomRoom.x += moveAlongX ? moveX : 0;
    randomRoom.y += moveAlongX ? 0 : moveY;
  }

  makeDoors() {
    const doors = [];
    this.rooms.forEach(room =>
      room.neighbors.forEach(neighbor => {
        const { x, y } = room.getDoor(neighbor);
        if (doors.every(door => door.x !== x || door.y !== y)) {
          doors.push({ x, y });
        }
        this.map[x][y] = true;
      }),
    );
    return doors;
  }

  makeMap() {
    const allRoomBounds = Rect.fromRects(this.rooms);
    const mapWidth = allRoomBounds.x2 + 1;
    const mapHeight = allRoomBounds.y2 + 1;
    const map = Array.from({length: mapWidth}, () => Array(mapHeight).fill(false));
    this.rooms.forEach(room => {
      for (let x = room.x + 1; x < room.x2; x++) {
        for (let y = room.y + 1; y < room.y2; y++) {
          map[x][y] = true;
        }
      }
    });
    return map;
  }

  get mapSize() {
    const allRoomBounds = Rect.fromRects(this.rooms);
    return {
      width: (allRoomBounds.w + 1) * this.tileSize,
      height: (allRoomBounds.h + 1) * this.tileSize,
    };
  }
}
