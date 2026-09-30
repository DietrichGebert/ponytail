import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { Request, Response } from 'express';
export function databaseFailure(error: unknown) {
  if (error instanceof Prisma.PrismaClientInitializationError)
    return 'DATABASE_UNAVAILABLE';
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (['P2021', 'P2022'].includes(error.code))
      return 'DATABASE_SCHEMA_OUTDATED';
    if (['P1001', 'P1002', 'P1008', 'P1017', 'P2024'].includes(error.code))
      return 'DATABASE_UNAVAILABLE';
  }
  return null;
}
@Catch()
export class ProblemDetailsFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp(),
      response = ctx.getResponse<Response>(),
      request = ctx.getRequest<Request>();
    let status = HttpStatus.INTERNAL_SERVER_ERROR,
      title = 'Unable to complete this request',
      detail: string | string[] =
        'An unexpected error occurred. Please try again.';
    const code = databaseFailure(exception);
    if (code) {
      status = HttpStatus.SERVICE_UNAVAILABLE;
      title = 'Service temporarily unavailable';
      detail =
        'We cannot access your assessment right now. Please try again later.';
    } else if (
      exception instanceof Prisma.PrismaClientKnownRequestError &&
      ['P2002', 'P2004', 'P2025'].includes(exception.code)
    ) {
      status =
        exception.code === 'P2025' ? HttpStatus.NOT_FOUND : HttpStatus.CONFLICT;
      title = status === 404 ? 'Not found' : 'State conflict';
      detail =
        status === 404
          ? 'The requested record is no longer available.'
          : 'This change conflicts with the current record state. Refresh and try again.';
    } else if (exception instanceof HttpException) {
      status = exception.getStatus();
      const body = exception.getResponse();
      if (typeof body === 'string') detail = body;
      else {
        const value = body as {
          title?: string;
          error?: string;
          detail?: string;
          message?: string | string[];
        };
        title = value.title || value.error || exception.name;
        detail = value.detail || value.message || detail;
      }
    }
    if (status === 503) response.setHeader('Retry-After', '30');
    response
      .status(status)
      .setHeader('Content-Type', 'application/problem+json')
      .json({
        type: 'about:blank',
        title,
        status,
        detail,
        instance: request.path,
        ...(code ? { code } : {}),
      });
  }
}
