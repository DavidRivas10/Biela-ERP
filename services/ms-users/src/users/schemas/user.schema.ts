import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument, Types } from "mongoose";
import { Role } from "../../roles/schemas/role.schema";

export type UserDocument = HydratedDocument<User>;

@Schema({ timestamps: true, versionKey: false, toJSON: { virtuals: true } })
export class User {
  @Prop({
    required: true,
    unique: true,
    index: true,
    trim: true,
    lowercase: true,
  })
  email!: string;

  @Prop({ required: true, select: false })
  passwordHash!: string;

  @Prop({ required: true, trim: true })
  firstName!: string;

  @Prop({ required: true, trim: true })
  lastName!: string;

  @Prop({ type: [{ type: Types.ObjectId, ref: Role.name }], default: [] })
  roles!: Types.ObjectId[];

  @Prop({ default: true })
  active!: boolean;
}

export const UserSchema = SchemaFactory.createForClass(User);
UserSchema.set("toJSON", {
  virtuals: true,
  transform: (_document, returned) => {
    const output = returned as unknown as Record<string, unknown> & {
      passwordHash?: string;
      __v?: number;
    };
    delete output.passwordHash;
    delete output.__v;
    return output;
  },
});
