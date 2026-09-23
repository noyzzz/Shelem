/** Shared by home and setup without loading room meshes or textures. */
export function HomeRoomBackdrop() {
  return (
    <div aria-hidden="true" className="home-room">
      <div className="home-room-window">
        <div className="home-room-garden" />
        <div className="home-room-window-frame" />
      </div>
      <div className="home-room-floor" />
      <div className="home-room-sunlight" />
    </div>
  );
}
