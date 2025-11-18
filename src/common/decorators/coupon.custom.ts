/* eslint-disable @typescript-eslint/no-unused-vars */
import {
  ValidationArguments,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';

@ValidatorConstraint({ name: 'CouponValidator', async: false })
export class CouponValidator implements ValidatorConstraintInterface {
  validate(value: any, args: ValidationArguments) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const obj = args.object as any;
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-member-access
    const fromDate = new Date(obj.fromDate);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-member-access
    const toDate = new Date(obj.toDate);
    const now = new Date();
    return fromDate >= now && fromDate < toDate;
  }
  defaultMessage(args: ValidationArguments) {
    return 'fromDate must be greater than or equal to today and less than toDate';
  }
}
