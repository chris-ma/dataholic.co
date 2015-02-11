var App = App || {};

(function(App){
  App.Campaign = Backbone.Model.extend({
        urlRoot: "/api/campaigns"
  });
})(App);