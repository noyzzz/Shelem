export type MediaCredentials = { token: string; url: string };
export type RequestMediaCredentials = () => Promise<MediaCredentials>;
export type SeatVideoTargets = Readonly<Record<string, HTMLElement>>;
