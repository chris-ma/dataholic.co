'use strict';

var App = App || {};

(function() {
  App.campaignsView = Backbone.View.extend({

    initialize: function(){
      App.campaignsCollection.on("add", this.render, this );
    },

    render: function(){
      this.$el.html(
        JST['campaign/panel']({ campaigns: App.campaignsCollection.toJSON() })
        );
      return this
    },
    


  })


})(App);