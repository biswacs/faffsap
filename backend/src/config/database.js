import { Sequelize } from "sequelize";

if (!process.env.DATABASE_URL) {
  throw new Error("DB url is missing.");
}

const sequelize = new Sequelize(process.env.DATABASE_URL, {
  dialect: "postgres",
  logging: false,
  pool: {
    max: 5,
    min: 0,
    acquire: 30000,
    idle: 10000,
  },
});

export default sequelize;
