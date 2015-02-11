var App = App || {};

(function(App){
  App.Campaigns = Backbone.Collection.extend({
    url: "/api/campaigns",
    model: App.Campaign
  });
  App.campaignsCollection = new App.Collections();
})(App);