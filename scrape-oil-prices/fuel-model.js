import mongoose from "mongoose";

const FuelPriceSchema = new mongoose.Schema(
  {
    country: { type: String, required: true },
    countryCode: { type: String, required: true },
    petrol: { type: Number, required: true },
    diesel: { type: Number, required: true },
    currencyHome: { type: String },
    petrolHome: { type: Number },
    dieselHome: { type: Number },
  },
  { _id: false }
);

const FuelSchema = new mongoose.Schema(
  {
    date: {
      type: String,
      required: true,
      unique: true,
      index: true,
      match: /^\d{4}-\d{2}-\d{2}$/,
    },
    countries: { type: [FuelPriceSchema], required: true },
  },
  { timestamps: true }
);

FuelSchema.index({ date: -1 });

const Fuel =
  mongoose.models.Fuel ||
  mongoose.model("Fuel", FuelSchema, "fuels");

export default Fuel;
