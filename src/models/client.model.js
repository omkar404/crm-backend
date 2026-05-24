const mongoose = require("mongoose");

const Counter = require("./counter.model");
const CHA = require("./cha.model");

const dscLogSchema = new mongoose.Schema({
  status: {
    type: String,
    enum: ["Inward", "Outward"]
  },
  note: String,
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User"
  },
  date: {
    type: Date,
    default: Date.now
  }
});

const portalCredentialSchema = new mongoose.Schema(
  {
    portalName: String,
    userId: String,
    password: {
      type: String,
      select: false
    }
  },
  { _id: false }
);

const clientSchema = new mongoose.Schema(
  {
    clientId: {
      type: String,
      unique: true,
      required: true
    },

    name: {
      type: String,
      required: true,
      trim: true
    },

    source: {
      type: String,
      enum: ["Direct", "CHA"],
      default: "Direct"
    },

    chaId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "CHA"
    },

    chaName: String,

    contactPerson: String,

    contactEmail: {
      type: String,
      lowercase: true
    },

    contactMobile: String,

    dgftLogin: String,
    dgftPassword: {
      type: String,
      select: false
    },

    icegateLogin: String,
    icegatePassword: {
      type: String,
      select: false
    },
    additionalPortalCredentials: {
      type: [portalCredentialSchema],
      default: []
    },

    dscHolder: String,
    dscExpiry: Date,

    dscLocation: {
      type: String,
      default: "Office Safe"
    },

    dscStatus: {
      type: String,
      enum: ["Inward", "Outward"],
      default: "Outward"
    },

dscLog: {
  type: [dscLogSchema],
  default: []
},

    authSignatoryName: String,

    authSignatoryMobile: String,

    authSignatoryAadhaar: {
      type: String,
      select: false
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User"
    },

    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User"
    }
  },
  { timestamps: true }
);

const parseCdcrParts = (clientId = "") => {
  const match = String(clientId).trim().match(/^CDCR-(\d+)(?:-(\d+))?$/i);
  if (!match) return null;

  return {
    series: Number(match[1]),
    suffix: match[2] ? Number(match[2]) : null,
  };
};

const nextCdcrSeriesNumber = async () => {
  const ClientModel = mongoose.models.Client;
  const existingClients = ClientModel
    ? await ClientModel.find({}, { clientId: 1 }).lean()
    : [];
  const existingChas = await CHA.find({}, { cdcrBase: 1 }).lean();

  const maxClientSeries = existingClients.reduce((max, item) => {
    const parsed = parseCdcrParts(item.clientId);
    return parsed ? Math.max(max, parsed.series) : max;
  }, 500);
  const maxChaSeries = existingChas.reduce((max, item) => {
    const parsed = parseCdcrParts(item.cdcrBase);
    return parsed ? Math.max(max, parsed.series) : max;
  }, 500);
  const maxExistingSeries = Math.max(maxClientSeries, maxChaSeries);

  let counter = await Counter.findOne({ name: "clientId" });
  if (!counter) {
    counter = await Counter.create({
      name: "clientId",
      value: maxExistingSeries
    });
  } else if (counter.value < maxExistingSeries) {
    counter.value = maxExistingSeries;
    await counter.save();
  }

  counter.value += 1;
  await counter.save();

  return counter.value;
};

clientSchema.pre("validate", async function autoGenerateClientId(next) {
  if (this.clientId) {
    return next();
  }

  try {
    if (this.source === "CHA" && this.chaId) {
      const cha = await CHA.findById(this.chaId);

      if (!cha) {
        return next(new Error("Invalid CHA"));
      }

      let cdcrBase = cha.cdcrBase || "";

      if (!cdcrBase) {
        const existingChaClients = await this.constructor
          .find({ chaId: cha._id })
          .select("clientId")
          .lean();

        const firstParsed = existingChaClients
          .map((item) => parseCdcrParts(item.clientId))
          .find(Boolean);

        if (firstParsed) {
          cdcrBase = `CDCR-${firstParsed.series}`;
        } else {
          const nextSeries = await nextCdcrSeriesNumber();
          cdcrBase = `CDCR-${nextSeries}`;
        }

        cha.cdcrBase = cdcrBase;
        await cha.save();
      }

      const existingChaClients = await this.constructor
        .find({ chaId: cha._id })
        .select("clientId")
        .lean();

      const maxSuffix = existingChaClients.reduce((max, item) => {
        const parsed = parseCdcrParts(item.clientId);
        if (!parsed) return max;
        if (`CDCR-${parsed.series}` !== cdcrBase) return max;
        return Math.max(max, parsed.suffix || 0);
      }, 0);

      this.clientId = `${cdcrBase}-${maxSuffix + 1}`;
      this.chaName = this.chaName || cha.chaname;
      return next();
    }

    const series = await nextCdcrSeriesNumber();
    this.clientId = `CDCR-${series}`;
    return next();
  } catch (error) {
    return next(error);
  }
});

module.exports = mongoose.model("Client", clientSchema);
