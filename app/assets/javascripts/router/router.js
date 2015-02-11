'use strict';

var App = App ||{};
(function(App){
App.Router = Backbone.Router.extend({
  routes: {
    '': 'campaigns',
    'campaigns': 'campaigns',
  },

  initialize: function() {
    App.rootView = new App.AppView();
    $("#app-container").html(App.rootView.render().el);
  },

  campaigns: function() {
    App.campaignsCollection.fetch().then(function() {
      App.rootView.display(App.campaignsView);
    });
    }
  });
  App.router = new App.Router();
})(App);