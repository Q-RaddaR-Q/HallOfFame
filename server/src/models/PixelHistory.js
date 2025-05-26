const { Model, DataTypes } = require('sequelize');
const sequelize = require('../config/database');

class PixelHistory extends Model {}

PixelHistory.init({
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
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
  ownerId: {
    type: DataTypes.STRING,
    allowNull: false
  },
  ownerName: {
    type: DataTypes.STRING,
    allowNull: false
  },
  link: {
    type: DataTypes.STRING,
    allowNull: true
  },
  isSecured: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false
  },
  securityExpiresAt: {
    type: DataTypes.DATE,
    allowNull: true
  },
  paymentIntentId: {
    type: DataTypes.STRING,
    allowNull: true
  },
  createdAt: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW
  }
}, {
  sequelize,
  modelName: 'PixelHistory',
  tableName: 'pixel_history',
  timestamps: true,
  indexes: [
    {
      fields: ['x', 'y']
    },
    {
      fields: ['createdAt']
    }
  ]
});

module.exports = PixelHistory; 