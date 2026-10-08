import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus } from '@nestjs/common';

@Catch()
export class HttpErrorFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse();
    const status = exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
    const raw = exception instanceof HttpException ? exception.getResponse() : 'Something went wrong.';
    const message = typeof raw === 'string' ? raw : (raw as { message?: string | string[] }).message || 'Request failed.';
    response.status(status).json({
      statusCode: status,
      message: Array.isArray(message) ? message.join(' ') : message,
      error: HttpStatus[status] || 'Error',
    });
  }
}
