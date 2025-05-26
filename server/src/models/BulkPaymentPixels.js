const { Model, DataTypes } = require('sequelize');
const sequelize = require('../config/database');

class BulkPaymentPixels extends Model {}

BulkPaymentPixels.init({
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  sessionId: {
    type: DataTypes.STRING,
    allowNull: false,
    index: true
  },
  x: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  y: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  color: {
    type: DataTypes.STRING,
    allowNull: false
  },
  price: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false
  },
  withSecurity: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false
  },
  createdAt: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW
  }
}, {
  sequelize,
  modelName: 'BulkPaymentPixels',
  tableName: 'bulk_payment_pixels',
  timestamps: true,
  indexes: [
    {
      fields: ['sessionId']
    },
    {
      fields: ['createdAt']
    }
  ]
});

module.exports = BulkPaymentPixels; 