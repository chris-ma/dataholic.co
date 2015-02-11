var App = App ||{};
(function(App){
App.Router = Backbone.Router.extend({
  routes: {
    '': 'campaigns',
    'campaigns': 'campaigns',
    
  },

  initialize: function() {
    App.rootView = new App.AppView();
  },

  campaigns: function() {
    App.campaignsCollection.fetch().then(function() {
      App.rootView.display(App.PlanesView);
    });
    }
  });
  App.router = new App.Router();
})(App);