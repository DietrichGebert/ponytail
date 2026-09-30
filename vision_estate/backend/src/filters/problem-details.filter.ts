import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Request, Response } from 'express';

@Catch()
export class ProblemDetailsFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let title = 'Internal Server Error';
    let detail = 'An unexpected error occurred processing your request.';
    let type = 'https://docs.vision-estates.internal/errors/internal';
    let errors: any = undefined;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const res: any = exception.getResponse();
      if (typeof res === 'object') {
        title = res.title || res.error || exception.name;
        detail = res.detail || res.message || detail;
        type =
          res.type ||
          `https://docs.vision-estates.internal/errors/http-${status}`;
        errors = res.errors;
      } else {
        detail = res;
      }
    }

    response
      .status(status)
      .setHeader('Content-Type', 'application/problem+json')
      .json({
        type,
        title,
        status,
        detail,
        instance: request.url,
        ...(errors ? { errors } : {}),
      });
  }
}
