export interface OutboundMessage {
  recipientId: string;
  body: string;
}

export interface ChannelService {
  send(message: OutboundMessage): Promise<void>;
}
