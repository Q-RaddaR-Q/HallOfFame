const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Pixel = sequelize.define('Pixel', {
  x: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  y: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  color: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  price: {
    type: DataTypes.FLOAT,
    allowNull: false,
    defaultValue: 0,
  },
  ownerId: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  ownerName: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  link: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  lastUpdated: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
  },
  isSecured: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false,
  },
  securityExpiresAt: {
    type: DataTypes.DATE,
    allowNull: true,
  }
}, {
  indexes: [
    {
      unique: true,
      fields: ['x', 'y']
    }
  ]
});

module.exports = Pixel; 