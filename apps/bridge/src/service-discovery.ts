import Bonjour from 'bonjour-service';

export interface BridgeDiscoveryDetails {
  port: number;
  hostId: string;
  hostName: string;
  hostPublicKey: string;
}

export function publishBridgeService(details: BridgeDiscoveryDetails): { stop: () => void } {
  const bonjour = new Bonjour();
  const service = bonjour.publish({
    name: details.hostName,
    type: 'agent-deck',
    protocol: 'tcp',
    port: details.port,
    txt: {
      v: '1',
      hostId: details.hostId,
      hostName: details.hostName,
      hostPublicKey: details.hostPublicKey,
    },
  });

  return {
    stop: () => {
      service.stop();
      bonjour.destroy();
    },
  };
}
