import { Injectable } from '@nestjs/common';
import type { ChannelService, OutboundMessage } from './channel.interface';

// TODO(ADR-011): concrete WhatsApp/Meta SDK integration lands here only.
// No other module may import a WhatsApp/Meta SDK directly — see the
// dependency-cruiser boundary rules (Sprint 0 Task 4).
@Injectable()
export class MessagingService implements ChannelService {
  async send(_message: OutboundMessage): Promise<void> {
    // stub — no SDK call yet
  }
}
