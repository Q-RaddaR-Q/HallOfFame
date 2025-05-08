module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('Pixels', 'link', {
      type: Sequelize.STRING,
      allowNull: true
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('Pixels', 'link');
  }
}; 