declare module "react-native-zeroconf" {
  type Listener = (...args: any[]) => void;

  export default class Zeroconf {
    on(event: string, listener: Listener): void;
    scan(type: string, protocol: string, domain: string, implementation?: string): void;
    stop(implementation?: string): void;
    removeDeviceListeners(): void;
  }
}
