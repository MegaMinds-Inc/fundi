import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  ForbiddenException,
  HttpException,
  Logger,
} from '@nestjs/common';
import type { Response } from 'express';
import { CrossTenantWriteError, MissingOrgContextError } from '../../prisma';

/**
 * Maps the org-scope engine's loud-fail errors to a `403` at the HTTP boundary
 * — never a `200` with unscoped/cross-tenant data. This is the guardrail QA
 * insists stay a required check (C.2.1/C.2.7): a future refactor that swallows
 * either error into a success response would be caught here (and by the
 * HTTP-boundary tests).
 *
 * - `MissingOrgContextError` fires when a tenant query runs with no org bound —
 *   e.g. an org-less token reaching a tenant route.
 * - `CrossTenantWriteError` (the D.1 create-path guard) fires when a write
 *   supplies an `organisationId` different from the bound context — an attempted
 *   cross-tenant write. It is exhaustively covered at the engine layer
 *   (org-scope.test.ts); mapping it here turns a would-be unmapped `500` into a
 *   semantically-correct, loud `403`.
 */
@Catch(MissingOrgContextError, CrossTenantWriteError)
export class OrgContextExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(OrgContextExceptionFilter.name);

  catch(exception: MissingOrgContextError | CrossTenantWriteError, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();

    // Loud on the server side too — this should never fire on a correct path.
    this.logger.error(`${exception.name}: ${exception.message}`);

    const code =
      exception instanceof CrossTenantWriteError
        ? 'cross_tenant_write_forbidden'
        : 'org_context_required';
    const http = new ForbiddenException({ code, message: exception.message });
    const status = http.getStatus();
    const body = (http as HttpException).getResponse();
    response.status(status).json(body);
  }
}
