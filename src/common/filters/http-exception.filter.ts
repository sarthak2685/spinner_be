import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus } from '@nestjs/common';

@Catch()
export class HttpErrorFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse();
    const dbCode = (exception as { code?: string }).code;
    if (!(exception instanceof HttpException)) console.error(exception);
    const status = exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
    const fallback = dbCode === '42P01' || dbCode === '42703'
      ? 'The hosted database is missing a table or column this page needs. Restart the API after the schema is loaded.'
      : 'Something went wrong.';
    const raw = exception instanceof HttpException ? exception.getResponse() : fallback;
    const message = typeof raw === 'string' ? raw : (raw as { message?: string | string[] }).message || 'Request failed.';
    response.status(status).json({
      statusCode: status,
      message: Array.isArray(message) ? message.join(' ') : message,
      error: HttpStatus[status] || 'Error',
    });
  }
}
