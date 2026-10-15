export class LoginDto {
  mobile!: string;
  password!: string;
  remember?: boolean;
  email?: string;
}

export class ForgotDto {
  identifier!: string;
}

export class ResetDto {
  token!: string;
  password!: string;
  confirm!: string;
}
