var App = App ||{}

(function(App){
  App.AppView = Backbone.View.extend({
    render: function() {
      this.$el.html(
        JST['application/layout']
        );
      return this;
      }

  })

})(App);