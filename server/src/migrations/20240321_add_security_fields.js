module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('Pixels', 'isSecured', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false
    });

    await queryInterface.addColumn('Pixels', 'securityExpiresAt', {
      type: Sequelize.DATE,
      allowNull: true
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('Pixels', 'isSecured');
    await queryInterface.removeColumn('Pixels', 'securityExpiresAt');
  }
}; 