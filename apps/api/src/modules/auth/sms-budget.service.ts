import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma';
import { resolveSmsDailyBudget } from './auth.constants';

/**
 * Global SMS-budget circuit-breaker (feature 0010 §7.7). Protects the very
 * balance this feature exists to save: per-phone caps (`OTP_ISSUANCE_CAP`) bound
 * one victim but not the org-wide balance — an attacker with many numbers, or
 * rotating IPs past the per-IP throttle, can still drain it (SMS pumping). This
 * adds an org-wide daily ceiling that FAILS CLOSED and alerts.
 *
 * The count is the number of `OtpChallenge` rows created since the start of the
 * current UTC day — each issued challenge is one dispatched code, so the row
 * count is a persistent, restart-safe proxy for "sends today". It is checked
 * from `AuthService` BEFORE any `OtpService.request` (enrollment AND forgot-PIN)
 * so both send paths are covered without editing the OTP service.
 *
 * Enumeration-safe: the check depends only on the global count, never on whether
 * a given phone exists — the breaker trips identically regardless.
 */
@Injectable()
export class SmsBudgetService {
  private readonly logger = new Logger(SmsBudgetService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Throw `503 sms_budget_exceeded` (and log an ops alert) when today's send
   * count has reached the configured ceiling. A null budget (`SMS_DAILY_BUDGET`
   * unset/non-positive) means the breaker is OFF — a no-op.
   */
  async assertWithinBudget(): Promise<void> {
    const budget = resolveSmsDailyBudget();
    if (budget == null) {
      return;
    }
    const startOfDay = new Date();
    startOfDay.setUTCHours(0, 0, 0, 0);
    const sentToday = await this.prisma.client.otpChallenge.count({
      where: { createdAt: { gte: startOfDay } },
    });
    if (sentToday >= budget) {
      // Ops alert — this should page someone; it means we are either under a
      // pumping attack or genuinely over volume. Fail closed, never a silent send.
      this.logger.error(
        `SMS daily budget exceeded: ${sentToday}/${budget} codes issued today (UTC) — failing closed on further sends (feature 0010 §7.7).`,
      );
      throw new HttpException(
        {
          code: 'sms_budget_exceeded',
          message: 'This service is temporarily unavailable. Please try again later.',
        },
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
  }
}
