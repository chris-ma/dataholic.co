(function($, undefined) {

/**
 * Unobtrusive scripting adapter for jQuery
 * https://github.com/rails/jquery-ujs
 *
 * Requires jQuery 1.8.0 or later.
 *
 * Released under the MIT license
 *
 */

  // Cut down on the number of issues from people inadvertently including jquery_ujs twice
  // by detecting and raising an error when it happens.
  if ( $.rails !== undefined ) {
    $.error('jquery-ujs has already been loaded!');
  }

  // Shorthand to make it a little easier to call public rails functions from within rails.js
  var rails;
  var $document = $(document);

  $.rails = rails = {
    // Link elements bound by jquery-ujs
    linkClickSelector: 'a[data-confirm], a[data-method], a[data-remote], a[data-disable-with], a[data-disable]',

    // Button elements bound by jquery-ujs
    buttonClickSelector: 'button[data-remote]:not(form button), button[data-confirm]:not(form button)',

    // Select elements bound by jquery-ujs
    inputChangeSelector: 'select[data-remote], input[data-remote], textarea[data-remote]',

    // Form elements bound by jquery-ujs
    formSubmitSelector: 'form',

    // Form input elements bound by jquery-ujs
    formInputClickSelector: 'form input[type=submit], form input[type=image], form button[type=submit], form button:not([type]), input[type=submit][form], input[type=image][form], button[type=submit][form], button[form]:not([type])',

    // Form input elements disabled during form submission
    disableSelector: 'input[data-disable-with]:enabled, button[data-disable-with]:enabled, textarea[data-disable-with]:enabled, input[data-disable]:enabled, button[data-disable]:enabled, textarea[data-disable]:enabled',

    // Form input elements re-enabled after form submission
    enableSelector: 'input[data-disable-with]:disabled, button[data-disable-with]:disabled, textarea[data-disable-with]:disabled, input[data-disable]:disabled, button[data-disable]:disabled, textarea[data-disable]:disabled',

    // Form required input elements
    requiredInputSelector: 'input[name][required]:not([disabled]),textarea[name][required]:not([disabled])',

    // Form file input elements
    fileInputSelector: 'input[type=file]',

    // Link onClick disable selector with possible reenable after remote submission
    linkDisableSelector: 'a[data-disable-with], a[data-disable]',

    // Button onClick disable selector with possible reenable after remote submission
    buttonDisableSelector: 'button[data-remote][data-disable-with], button[data-remote][data-disable]',

    // Make sure that every Ajax request sends the CSRF token
    CSRFProtection: function(xhr) {
      var token = $('meta[name="csrf-token"]').attr('content');
      if (token) xhr.setRequestHeader('X-CSRF-Token', token);
    },

    // making sure that all forms have actual up-to-date token(cached forms contain old one)
    refreshCSRFTokens: function(){
      var csrfToken = $('meta[name=csrf-token]').attr('content');
      var csrfParam = $('meta[name=csrf-param]').attr('content');
      $('form input[name="' + csrfParam + '"]').val(csrfToken);
    },

    // Triggers an event on an element and returns false if the event result is false
    fire: function(obj, name, data) {
      var event = $.Event(name);
      obj.trigger(event, data);
      return event.result !== false;
    },

    // Default confirm dialog, may be overridden with custom confirm dialog in $.rails.confirm
    confirm: function(message) {
      return confirm(message);
    },

    // Default ajax function, may be overridden with custom function in $.rails.ajax
    ajax: function(options) {
      return $.ajax(options);
    },

    // Default way to get an element's href. May be overridden at $.rails.href.
    href: function(element) {
      return element.attr('href');
    },

    // Submits "remote" forms and links with ajax
    handleRemote: function(element) {
      var method, url, data, elCrossDomain, crossDomain, withCredentials, dataType, options;

      if (rails.fire(element, 'ajax:before')) {
        elCrossDomain = element.data('cross-domain');
        crossDomain = elCrossDomain === undefined ? null : elCrossDomain;
        withCredentials = element.data('with-credentials') || null;
        dataType = element.data('type') || ($.ajaxSettings && $.ajaxSettings.dataType);

        if (element.is('form')) {
          method = element.attr('method');
          url = element.attr('action');
          data = element.serializeArray();
          // memoized value from clicked submit button
          var button = element.data('ujs:submit-button');
          if (button) {
            data.push(button);
            element.data('ujs:submit-button', null);
          }
        } else if (element.is(rails.inputChangeSelector)) {
          method = element.data('method');
          url = element.data('url');
          data = element.serialize();
          if (element.data('params')) data = data + "&" + element.data('params');
        } else if (element.is(rails.buttonClickSelector)) {
          method = element.data('method') || 'get';
          url = element.data('url');
          data = element.serialize();
          if (element.data('params')) data = data + "&" + element.data('params');
        } else {
          method = element.data('method');
          url = rails.href(element);
          data = element.data('params') || null;
        }

        options = {
          type: method || 'GET', data: data, dataType: dataType,
          // stopping the "ajax:beforeSend" event will cancel the ajax request
          beforeSend: function(xhr, settings) {
            if (settings.dataType === undefined) {
              xhr.setRequestHeader('accept', '*/*;q=0.5, ' + settings.accepts.script);
            }
            if (rails.fire(element, 'ajax:beforeSend', [xhr, settings])) {
              element.trigger('ajax:send', xhr);
            } else {
              return false;
            }
          },
          success: function(data, status, xhr) {
            element.trigger('ajax:success', [data, status, xhr]);
          },
          complete: function(xhr, status) {
            element.trigger('ajax:complete', [xhr, status]);
          },
          error: function(xhr, status, error) {
            element.trigger('ajax:error', [xhr, status, error]);
          },
          crossDomain: crossDomain
        };

        // There is no withCredentials for IE6-8 when
        // "Enable native XMLHTTP support" is disabled
        if (withCredentials) {
          options.xhrFields = {
            withCredentials: withCredentials
          };
        }

        // Only pass url to `ajax` options if not blank
        if (url) { options.url = url; }

        return rails.ajax(options);
      } else {
        return false;
      }
    },

    // Handles "data-method" on links such as:
    // <a href="/users/5" data-method="delete" rel="nofollow" data-confirm="Are you sure?">Delete</a>
    handleMethod: function(link) {
      var href = rails.href(link),
        method = link.data('method'),
        target = link.attr('target'),
        csrfToken = $('meta[name=csrf-token]').attr('content'),
        csrfParam = $('meta[name=csrf-param]').attr('content'),
        form = $('<form method="post" action="' + href + '"></form>'),
        metadataInput = '<input name="_method" value="' + method + '" type="hidden" />';

      if (csrfParam !== undefined && csrfToken !== undefined) {
        metadataInput += '<input name="' + csrfParam + '" value="' + csrfToken + '" type="hidden" />';
      }

      if (target) { form.attr('target', target); }

      form.hide().append(metadataInput).appendTo('body');
      form.submit();
    },

    // Helper function that returns form elements that match the specified CSS selector
    // If form is actually a "form" element this will return associated elements outside the from that have
    // the html form attribute set
    formElements: function(form, selector) {
      return form.is('form') ? $(form[0].elements).filter(selector) : form.find(selector);
    },

    /* Disables form elements:
      - Caches element value in 'ujs:enable-with' data store
      - Replaces element text with value of 'data-disable-with' attribute
      - Sets disabled property to true
    */
    disableFormElements: function(form) {
      rails.formElements(form, rails.disableSelector).each(function() {
        rails.disableFormElement($(this));
      });
    },

    disableFormElement: function(element) {
      var method, replacement;

      method = element.is('button') ? 'html' : 'val';
      replacement = element.data('disable-with');

      element.data('ujs:enable-with', element[method]());
      if (replacement !== undefined) {
        element[method](replacement);
      }

      element.prop('disabled', true);
    },

    /* Re-enables disabled form elements:
      - Replaces element text with cached value from 'ujs:enable-with' data store (created in `disableFormElements`)
      - Sets disabled property to false
    */
    enableFormElements: function(form) {
      rails.formElements(form, rails.enableSelector).each(function() {
        rails.enableFormElement($(this));
      });
    },

    enableFormElement: function(element) {
      var method = element.is('button') ? 'html' : 'val';
      if (element.data('ujs:enable-with')) element[method](element.data('ujs:enable-with'));
      element.prop('disabled', false);
    },

   /* For 'data-confirm' attribute:
      - Fires `confirm` event
      - Shows the confirmation dialog
      - Fires the `confirm:complete` event

      Returns `true` if no function stops the chain and user chose yes; `false` otherwise.
      Attaching a handler to the element's `confirm` event that returns a `falsy` value cancels the confirmation dialog.
      Attaching a handler to the element's `confirm:complete` event that returns a `falsy` value makes this function
      return false. The `confirm:complete` event is fired whether or not the user answered true or false to the dialog.
   */
    allowAction: function(element) {
      var message = element.data('confirm'),
          answer = false, callback;
      if (!message) { return true; }

      if (rails.fire(element, 'confirm')) {
        answer = rails.confirm(message);
        callback = rails.fire(element, 'confirm:complete', [answer]);
      }
      return answer && callback;
    },

    // Helper function which checks for blank inputs in a form that match the specified CSS selector
    blankInputs: function(form, specifiedSelector, nonBlank) {
      var inputs = $(), input, valueToCheck,
          selector = specifiedSelector || 'input,textarea',
          allInputs = form.find(selector);

      allInputs.each(function() {
        input = $(this);
        valueToCheck = input.is('input[type=checkbox],input[type=radio]') ? input.is(':checked') : input.val();
        // If nonBlank and valueToCheck are both truthy, or nonBlank and valueToCheck are both falsey
        if (!valueToCheck === !nonBlank) {

          // Don't count unchecked required radio if other radio with same name is checked
          if (input.is('input[type=radio]') && allInputs.filter('input[type=radio]:checked[name="' + input.attr('name') + '"]').length) {
            return true; // Skip to next input
          }

          inputs = inputs.add(input);
        }
      });
      return inputs.length ? inputs : false;
    },

    // Helper function which checks for non-blank inputs in a form that match the specified CSS selector
    nonBlankInputs: function(form, specifiedSelector) {
      return rails.blankInputs(form, specifiedSelector, true); // true specifies nonBlank
    },

    // Helper function, needed to provide consistent behavior in IE
    stopEverything: function(e) {
      $(e.target).trigger('ujs:everythingStopped');
      e.stopImmediatePropagation();
      return false;
    },

    //  replace element's html with the 'data-disable-with' after storing original html
    //  and prevent clicking on it
    disableElement: function(element) {
      var replacement = element.data('disable-with');

      element.data('ujs:enable-with', element.html()); // store enabled state
      if (replacement !== undefined) {
        element.html(replacement);
      }

      element.bind('click.railsDisable', function(e) { // prevent further clicking
        return rails.stopEverything(e);
      });
    },

    // restore element to its original state which was disabled by 'disableElement' above
    enableElement: function(element) {
      if (element.data('ujs:enable-with') !== undefined) {
        element.html(element.data('ujs:enable-with')); // set to old enabled state
        element.removeData('ujs:enable-with'); // clean up cache
      }
      element.unbind('click.railsDisable'); // enable element
    }
  };

  if (rails.fire($document, 'rails:attachBindings')) {

    $.ajaxPrefilter(function(options, originalOptions, xhr){ if ( !options.crossDomain ) { rails.CSRFProtection(xhr); }});

    // This event works the same as the load event, except that it fires every
    // time the page is loaded.
    //
    // See https://github.com/rails/jquery-ujs/issues/357
    // See https://developer.mozilla.org/en-US/docs/Using_Firefox_1.5_caching
    $(window).on("pageshow.rails", function () {
      $($.rails.enableSelector).each(function () {
        var element = $(this);

        if (element.data("ujs:enable-with")) {
          $.rails.enableFormElement(element);
        }
      });

      $($.rails.linkDisableSelector).each(function () {
        var element = $(this);

        if (element.data("ujs:enable-with")) {
          $.rails.enableElement(element);
        }
      });
    });

    $document.delegate(rails.linkDisableSelector, 'ajax:complete', function() {
        rails.enableElement($(this));
    });

    $document.delegate(rails.buttonDisableSelector, 'ajax:complete', function() {
        rails.enableFormElement($(this));
    });

    $document.delegate(rails.linkClickSelector, 'click.rails', function(e) {
      var link = $(this), method = link.data('method'), data = link.data('params'), metaClick = e.metaKey || e.ctrlKey;
      if (!rails.allowAction(link)) return rails.stopEverything(e);

      if (!metaClick && link.is(rails.linkDisableSelector)) rails.disableElement(link);

      if (link.data('remote') !== undefined) {
        if (metaClick && (!method || method === 'GET') && !data) { return true; }

        var handleRemote = rails.handleRemote(link);
        // response from rails.handleRemote() will either be false or a deferred object promise.
        if (handleRemote === false) {
          rails.enableElement(link);
        } else {
          handleRemote.fail( function() { rails.enableElement(link); } );
        }
        return false;

      } else if (method) {
        rails.handleMethod(link);
        return false;
      }
    });

    $document.delegate(rails.buttonClickSelector, 'click.rails', function(e) {
      var button = $(this);

      if (!rails.allowAction(button)) return rails.stopEverything(e);

      if (button.is(rails.buttonDisableSelector)) rails.disableFormElement(button);

      var handleRemote = rails.handleRemote(button);
      // response from rails.handleRemote() will either be false or a deferred object promise.
      if (handleRemote === false) {
        rails.enableFormElement(button);
      } else {
        handleRemote.fail( function() { rails.enableFormElement(button); } );
      }
      return false;
    });

    $document.delegate(rails.inputChangeSelector, 'change.rails', function(e) {
      var link = $(this);
      if (!rails.allowAction(link)) return rails.stopEverything(e);

      rails.handleRemote(link);
      return false;
    });

    $document.delegate(rails.formSubmitSelector, 'submit.rails', function(e) {
      var form = $(this),
        remote = form.data('remote') !== undefined,
        blankRequiredInputs,
        nonBlankFileInputs;

      if (!rails.allowAction(form)) return rails.stopEverything(e);

      // skip other logic when required values are missing or file upload is present
      if (form.attr('novalidate') == undefined) {
        blankRequiredInputs = rails.blankInputs(form, rails.requiredInputSelector);
        if (blankRequiredInputs && rails.fire(form, 'ajax:aborted:required', [blankRequiredInputs])) {
          return rails.stopEverything(e);
        }
      }

      if (remote) {
        nonBlankFileInputs = rails.nonBlankInputs(form, rails.fileInputSelector);
        if (nonBlankFileInputs) {
          // slight timeout so that the submit button gets properly serialized
          // (make it easy for event handler to serialize form without disabled values)
          setTimeout(function(){ rails.disableFormElements(form); }, 13);
          var aborted = rails.fire(form, 'ajax:aborted:file', [nonBlankFileInputs]);

          // re-enable form elements if event bindings return false (canceling normal form submission)
          if (!aborted) { setTimeout(function(){ rails.enableFormElements(form); }, 13); }

          return aborted;
        }

        rails.handleRemote(form);
        return false;

      } else {
        // slight timeout so that the submit button gets properly serialized
        setTimeout(function(){ rails.disableFormElements(form); }, 13);
      }
    });

    $document.delegate(rails.formInputClickSelector, 'click.rails', function(event) {
      var button = $(this);

      if (!rails.allowAction(button)) return rails.stopEverything(event);

      // register the pressed submit button
      var name = button.attr('name'),
        data = name ? {name:name, value:button.val()} : null;

      button.closest('form').data('ujs:submit-button', data);
    });

    $document.delegate(rails.formSubmitSelector, 'ajax:send.rails', function(event) {
      if (this == event.target) rails.disableFormElements($(this));
    });

    $document.delegate(rails.formSubmitSelector, 'ajax:complete.rails', function(event) {
      if (this == event.target) rails.enableFormElements($(this));
    });

    $(function(){
      rails.refreshCSRFTokens();
    });
  }

})( jQuery );
/*!
 * Bootstrap v3.3.2 (http://getbootstrap.com)
 * Copyright 2011-2015 Twitter, Inc.
 * Licensed under MIT (https://github.com/twbs/bootstrap/blob/master/LICENSE)
 */


if (typeof jQuery === 'undefined') {
  throw new Error('Bootstrap\'s JavaScript requires jQuery')
}

+function ($) {
  'use strict';
  var version = $.fn.jquery.split(' ')[0].split('.')
  if ((version[0] < 2 && version[1] < 9) || (version[0] == 1 && version[1] == 9 && version[2] < 1)) {
    throw new Error('Bootstrap\'s JavaScript requires jQuery version 1.9.1 or higher')
  }
}(jQuery);

/* ========================================================================
 * Bootstrap: transition.js v3.3.2
 * http://getbootstrap.com/javascript/#transitions
 * ========================================================================
 * Copyright 2011-2015 Twitter, Inc.
 * Licensed under MIT (https://github.com/twbs/bootstrap/blob/master/LICENSE)
 * ======================================================================== */


+function ($) {
  'use strict';

  // CSS TRANSITION SUPPORT (Shoutout: http://www.modernizr.com/)
  // ============================================================

  function transitionEnd() {
    var el = document.createElement('bootstrap')

    var transEndEventNames = {
      WebkitTransition : 'webkitTransitionEnd',
      MozTransition    : 'transitionend',
      OTransition      : 'oTransitionEnd otransitionend',
      transition       : 'transitionend'
    }

    for (var name in transEndEventNames) {
      if (el.style[name] !== undefined) {
        return { end: transEndEventNames[name] }
      }
    }

    return false // explicit for ie8 (  ._.)
  }

  // http://blog.alexmaccaw.com/css-transitions
  $.fn.emulateTransitionEnd = function (duration) {
    var called = false
    var $el = this
    $(this).one('bsTransitionEnd', function () { called = true })
    var callback = function () { if (!called) $($el).trigger($.support.transition.end) }
    setTimeout(callback, duration)
    return this
  }

  $(function () {
    $.support.transition = transitionEnd()

    if (!$.support.transition) return

    $.event.special.bsTransitionEnd = {
      bindType: $.support.transition.end,
      delegateType: $.support.transition.end,
      handle: function (e) {
        if ($(e.target).is(this)) return e.handleObj.handler.apply(this, arguments)
      }
    }
  })

}(jQuery);

/* ========================================================================
 * Bootstrap: alert.js v3.3.2
 * http://getbootstrap.com/javascript/#alerts
 * ========================================================================
 * Copyright 2011-2015 Twitter, Inc.
 * Licensed under MIT (https://github.com/twbs/bootstrap/blob/master/LICENSE)
 * ======================================================================== */


+function ($) {
  'use strict';

  // ALERT CLASS DEFINITION
  // ======================

  var dismiss = '[data-dismiss="alert"]'
  var Alert   = function (el) {
    $(el).on('click', dismiss, this.close)
  }

  Alert.VERSION = '3.3.2'

  Alert.TRANSITION_DURATION = 150

  Alert.prototype.close = function (e) {
    var $this    = $(this)
    var selector = $this.attr('data-target')

    if (!selector) {
      selector = $this.attr('href')
      selector = selector && selector.replace(/.*(?=#[^\s]*$)/, '') // strip for ie7
    }

    var $parent = $(selector)

    if (e) e.preventDefault()

    if (!$parent.length) {
      $parent = $this.closest('.alert')
    }

    $parent.trigger(e = $.Event('close.bs.alert'))

    if (e.isDefaultPrevented()) return

    $parent.removeClass('in')

    function removeElement() {
      // detach from parent, fire event then clean up data
      $parent.detach().trigger('closed.bs.alert').remove()
    }

    $.support.transition && $parent.hasClass('fade') ?
      $parent
        .one('bsTransitionEnd', removeElement)
        .emulateTransitionEnd(Alert.TRANSITION_DURATION) :
      removeElement()
  }


  // ALERT PLUGIN DEFINITION
  // =======================

  function Plugin(option) {
    return this.each(function () {
      var $this = $(this)
      var data  = $this.data('bs.alert')

      if (!data) $this.data('bs.alert', (data = new Alert(this)))
      if (typeof option == 'string') data[option].call($this)
    })
  }

  var old = $.fn.alert

  $.fn.alert             = Plugin
  $.fn.alert.Constructor = Alert


  // ALERT NO CONFLICT
  // =================

  $.fn.alert.noConflict = function () {
    $.fn.alert = old
    return this
  }


  // ALERT DATA-API
  // ==============

  $(document).on('click.bs.alert.data-api', dismiss, Alert.prototype.close)

}(jQuery);

/* ========================================================================
 * Bootstrap: button.js v3.3.2
 * http://getbootstrap.com/javascript/#buttons
 * ========================================================================
 * Copyright 2011-2015 Twitter, Inc.
 * Licensed under MIT (https://github.com/twbs/bootstrap/blob/master/LICENSE)
 * ======================================================================== */


+function ($) {
  'use strict';

  // BUTTON PUBLIC CLASS DEFINITION
  // ==============================

  var Button = function (element, options) {
    this.$element  = $(element)
    this.options   = $.extend({}, Button.DEFAULTS, options)
    this.isLoading = false
  }

  Button.VERSION  = '3.3.2'

  Button.DEFAULTS = {
    loadingText: 'loading...'
  }

  Button.prototype.setState = function (state) {
    var d    = 'disabled'
    var $el  = this.$element
    var val  = $el.is('input') ? 'val' : 'html'
    var data = $el.data()

    state = state + 'Text'

    if (data.resetText == null) $el.data('resetText', $el[val]())

    // push to event loop to allow forms to submit
    setTimeout($.proxy(function () {
      $el[val](data[state] == null ? this.options[state] : data[state])

      if (state == 'loadingText') {
        this.isLoading = true
        $el.addClass(d).attr(d, d)
      } else if (this.isLoading) {
        this.isLoading = false
        $el.removeClass(d).removeAttr(d)
      }
    }, this), 0)
  }

  Button.prototype.toggle = function () {
    var changed = true
    var $parent = this.$element.closest('[data-toggle="buttons"]')

    if ($parent.length) {
      var $input = this.$element.find('input')
      if ($input.prop('type') == 'radio') {
        if ($input.prop('checked') && this.$element.hasClass('active')) changed = false
        else $parent.find('.active').removeClass('active')
      }
      if (changed) $input.prop('checked', !this.$element.hasClass('active')).trigger('change')
    } else {
      this.$element.attr('aria-pressed', !this.$element.hasClass('active'))
    }

    if (changed) this.$element.toggleClass('active')
  }


  // BUTTON PLUGIN DEFINITION
  // ========================

  function Plugin(option) {
    return this.each(function () {
      var $this   = $(this)
      var data    = $this.data('bs.button')
      var options = typeof option == 'object' && option

      if (!data) $this.data('bs.button', (data = new Button(this, options)))

      if (option == 'toggle') data.toggle()
      else if (option) data.setState(option)
    })
  }

  var old = $.fn.button

  $.fn.button             = Plugin
  $.fn.button.Constructor = Button


  // BUTTON NO CONFLICT
  // ==================

  $.fn.button.noConflict = function () {
    $.fn.button = old
    return this
  }


  // BUTTON DATA-API
  // ===============

  $(document)
    .on('click.bs.button.data-api', '[data-toggle^="button"]', function (e) {
      var $btn = $(e.target)
      if (!$btn.hasClass('btn')) $btn = $btn.closest('.btn')
      Plugin.call($btn, 'toggle')
      e.preventDefault()
    })
    .on('focus.bs.button.data-api blur.bs.button.data-api', '[data-toggle^="button"]', function (e) {
      $(e.target).closest('.btn').toggleClass('focus', /^focus(in)?$/.test(e.type))
    })

}(jQuery);

/* ========================================================================
 * Bootstrap: carousel.js v3.3.2
 * http://getbootstrap.com/javascript/#carousel
 * ========================================================================
 * Copyright 2011-2015 Twitter, Inc.
 * Licensed under MIT (https://github.com/twbs/bootstrap/blob/master/LICENSE)
 * ======================================================================== */


+function ($) {
  'use strict';

  // CAROUSEL CLASS DEFINITION
  // =========================

  var Carousel = function (element, options) {
    this.$element    = $(element)
    this.$indicators = this.$element.find('.carousel-indicators')
    this.options     = options
    this.paused      =
    this.sliding     =
    this.interval    =
    this.$active     =
    this.$items      = null

    this.options.keyboard && this.$element.on('keydown.bs.carousel', $.proxy(this.keydown, this))

    this.options.pause == 'hover' && !('ontouchstart' in document.documentElement) && this.$element
      .on('mouseenter.bs.carousel', $.proxy(this.pause, this))
      .on('mouseleave.bs.carousel', $.proxy(this.cycle, this))
  }

  Carousel.VERSION  = '3.3.2'

  Carousel.TRANSITION_DURATION = 600

  Carousel.DEFAULTS = {
    interval: 5000,
    pause: 'hover',
    wrap: true,
    keyboard: true
  }

  Carousel.prototype.keydown = function (e) {
    if (/input|textarea/i.test(e.target.tagName)) return
    switch (e.which) {
      case 37: this.prev(); break
      case 39: this.next(); break
      default: return
    }

    e.preventDefault()
  }

  Carousel.prototype.cycle = function (e) {
    e || (this.paused = false)

    this.interval && clearInterval(this.interval)

    this.options.interval
      && !this.paused
      && (this.interval = setInterval($.proxy(this.next, this), this.options.interval))

    return this
  }

  Carousel.prototype.getItemIndex = function (item) {
    this.$items = item.parent().children('.item')
    return this.$items.index(item || this.$active)
  }

  Carousel.prototype.getItemForDirection = function (direction, active) {
    var activeIndex = this.getItemIndex(active)
    var willWrap = (direction == 'prev' && activeIndex === 0)
                || (direction == 'next' && activeIndex == (this.$items.length - 1))
    if (willWrap && !this.options.wrap) return active
    var delta = direction == 'prev' ? -1 : 1
    var itemIndex = (activeIndex + delta) % this.$items.length
    return this.$items.eq(itemIndex)
  }

  Carousel.prototype.to = function (pos) {
    var that        = this
    var activeIndex = this.getItemIndex(this.$active = this.$element.find('.item.active'))

    if (pos > (this.$items.length - 1) || pos < 0) return

    if (this.sliding)       return this.$element.one('slid.bs.carousel', function () { that.to(pos) }) // yes, "slid"
    if (activeIndex == pos) return this.pause().cycle()

    return this.slide(pos > activeIndex ? 'next' : 'prev', this.$items.eq(pos))
  }

  Carousel.prototype.pause = function (e) {
    e || (this.paused = true)

    if (this.$element.find('.next, .prev').length && $.support.transition) {
      this.$element.trigger($.support.transition.end)
      this.cycle(true)
    }

    this.interval = clearInterval(this.interval)

    return this
  }

  Carousel.prototype.next = function () {
    if (this.sliding) return
    return this.slide('next')
  }

  Carousel.prototype.prev = function () {
    if (this.sliding) return
    return this.slide('prev')
  }

  Carousel.prototype.slide = function (type, next) {
    var $active   = this.$element.find('.item.active')
    var $next     = next || this.getItemForDirection(type, $active)
    var isCycling = this.interval
    var direction = type == 'next' ? 'left' : 'right'
    var that      = this

    if ($next.hasClass('active')) return (this.sliding = false)

    var relatedTarget = $next[0]
    var slideEvent = $.Event('slide.bs.carousel', {
      relatedTarget: relatedTarget,
      direction: direction
    })
    this.$element.trigger(slideEvent)
    if (slideEvent.isDefaultPrevented()) return

    this.sliding = true

    isCycling && this.pause()

    if (this.$indicators.length) {
      this.$indicators.find('.active').removeClass('active')
      var $nextIndicator = $(this.$indicators.children()[this.getItemIndex($next)])
      $nextIndicator && $nextIndicator.addClass('active')
    }

    var slidEvent = $.Event('slid.bs.carousel', { relatedTarget: relatedTarget, direction: direction }) // yes, "slid"
    if ($.support.transition && this.$element.hasClass('slide')) {
      $next.addClass(type)
      $next[0].offsetWidth // force reflow
      $active.addClass(direction)
      $next.addClass(direction)
      $active
        .one('bsTransitionEnd', function () {
          $next.removeClass([type, direction].join(' ')).addClass('active')
          $active.removeClass(['active', direction].join(' '))
          that.sliding = false
          setTimeout(function () {
            that.$element.trigger(slidEvent)
          }, 0)
        })
        .emulateTransitionEnd(Carousel.TRANSITION_DURATION)
    } else {
      $active.removeClass('active')
      $next.addClass('active')
      this.sliding = false
      this.$element.trigger(slidEvent)
    }

    isCycling && this.cycle()

    return this
  }


  // CAROUSEL PLUGIN DEFINITION
  // ==========================

  function Plugin(option) {
    return this.each(function () {
      var $this   = $(this)
      var data    = $this.data('bs.carousel')
      var options = $.extend({}, Carousel.DEFAULTS, $this.data(), typeof option == 'object' && option)
      var action  = typeof option == 'string' ? option : options.slide

      if (!data) $this.data('bs.carousel', (data = new Carousel(this, options)))
      if (typeof option == 'number') data.to(option)
      else if (action) data[action]()
      else if (options.interval) data.pause().cycle()
    })
  }

  var old = $.fn.carousel

  $.fn.carousel             = Plugin
  $.fn.carousel.Constructor = Carousel


  // CAROUSEL NO CONFLICT
  // ====================

  $.fn.carousel.noConflict = function () {
    $.fn.carousel = old
    return this
  }


  // CAROUSEL DATA-API
  // =================

  var clickHandler = function (e) {
    var href
    var $this   = $(this)
    var $target = $($this.attr('data-target') || (href = $this.attr('href')) && href.replace(/.*(?=#[^\s]+$)/, '')) // strip for ie7
    if (!$target.hasClass('carousel')) return
    var options = $.extend({}, $target.data(), $this.data())
    var slideIndex = $this.attr('data-slide-to')
    if (slideIndex) options.interval = false

    Plugin.call($target, options)

    if (slideIndex) {
      $target.data('bs.carousel').to(slideIndex)
    }

    e.preventDefault()
  }

  $(document)
    .on('click.bs.carousel.data-api', '[data-slide]', clickHandler)
    .on('click.bs.carousel.data-api', '[data-slide-to]', clickHandler)

  $(window).on('load', function () {
    $('[data-ride="carousel"]').each(function () {
      var $carousel = $(this)
      Plugin.call($carousel, $carousel.data())
    })
  })

}(jQuery);

/* ========================================================================
 * Bootstrap: collapse.js v3.3.2
 * http://getbootstrap.com/javascript/#collapse
 * ========================================================================
 * Copyright 2011-2015 Twitter, Inc.
 * Licensed under MIT (https://github.com/twbs/bootstrap/blob/master/LICENSE)
 * ======================================================================== */


+function ($) {
  'use strict';

  // COLLAPSE PUBLIC CLASS DEFINITION
  // ================================

  var Collapse = function (element, options) {
    this.$element      = $(element)
    this.options       = $.extend({}, Collapse.DEFAULTS, options)
    this.$trigger      = $(this.options.trigger).filter('[href="#' + element.id + '"], [data-target="#' + element.id + '"]')
    this.transitioning = null

    if (this.options.parent) {
      this.$parent = this.getParent()
    } else {
      this.addAriaAndCollapsedClass(this.$element, this.$trigger)
    }

    if (this.options.toggle) this.toggle()
  }

  Collapse.VERSION  = '3.3.2'

  Collapse.TRANSITION_DURATION = 350

  Collapse.DEFAULTS = {
    toggle: true,
    trigger: '[data-toggle="collapse"]'
  }

  Collapse.prototype.dimension = function () {
    var hasWidth = this.$element.hasClass('width')
    return hasWidth ? 'width' : 'height'
  }

  Collapse.prototype.show = function () {
    if (this.transitioning || this.$element.hasClass('in')) return

    var activesData
    var actives = this.$parent && this.$parent.children('.panel').children('.in, .collapsing')

    if (actives && actives.length) {
      activesData = actives.data('bs.collapse')
      if (activesData && activesData.transitioning) return
    }

    var startEvent = $.Event('show.bs.collapse')
    this.$element.trigger(startEvent)
    if (startEvent.isDefaultPrevented()) return

    if (actives && actives.length) {
      Plugin.call(actives, 'hide')
      activesData || actives.data('bs.collapse', null)
    }

    var dimension = this.dimension()

    this.$element
      .removeClass('collapse')
      .addClass('collapsing')[dimension](0)
      .attr('aria-expanded', true)

    this.$trigger
      .removeClass('collapsed')
      .attr('aria-expanded', true)

    this.transitioning = 1

    var complete = function () {
      this.$element
        .removeClass('collapsing')
        .addClass('collapse in')[dimension]('')
      this.transitioning = 0
      this.$element
        .trigger('shown.bs.collapse')
    }

    if (!$.support.transition) return complete.call(this)

    var scrollSize = $.camelCase(['scroll', dimension].join('-'))

    this.$element
      .one('bsTransitionEnd', $.proxy(complete, this))
      .emulateTransitionEnd(Collapse.TRANSITION_DURATION)[dimension](this.$element[0][scrollSize])
  }

  Collapse.prototype.hide = function () {
    if (this.transitioning || !this.$element.hasClass('in')) return

    var startEvent = $.Event('hide.bs.collapse')
    this.$element.trigger(startEvent)
    if (startEvent.isDefaultPrevented()) return

    var dimension = this.dimension()

    this.$element[dimension](this.$element[dimension]())[0].offsetHeight

    this.$element
      .addClass('collapsing')
      .removeClass('collapse in')
      .attr('aria-expanded', false)

    this.$trigger
      .addClass('collapsed')
      .attr('aria-expanded', false)

    this.transitioning = 1

    var complete = function () {
      this.transitioning = 0
      this.$element
        .removeClass('collapsing')
        .addClass('collapse')
        .trigger('hidden.bs.collapse')
    }

    if (!$.support.transition) return complete.call(this)

    this.$element
      [dimension](0)
      .one('bsTransitionEnd', $.proxy(complete, this))
      .emulateTransitionEnd(Collapse.TRANSITION_DURATION)
  }

  Collapse.prototype.toggle = function () {
    this[this.$element.hasClass('in') ? 'hide' : 'show']()
  }

  Collapse.prototype.getParent = function () {
    return $(this.options.parent)
      .find('[data-toggle="collapse"][data-parent="' + this.options.parent + '"]')
      .each($.proxy(function (i, element) {
        var $element = $(element)
        this.addAriaAndCollapsedClass(getTargetFromTrigger($element), $element)
      }, this))
      .end()
  }

  Collapse.prototype.addAriaAndCollapsedClass = function ($element, $trigger) {
    var isOpen = $element.hasClass('in')

    $element.attr('aria-expanded', isOpen)
    $trigger
      .toggleClass('collapsed', !isOpen)
      .attr('aria-expanded', isOpen)
  }

  function getTargetFromTrigger($trigger) {
    var href
    var target = $trigger.attr('data-target')
      || (href = $trigger.attr('href')) && href.replace(/.*(?=#[^\s]+$)/, '') // strip for ie7

    return $(target)
  }


  // COLLAPSE PLUGIN DEFINITION
  // ==========================

  function Plugin(option) {
    return this.each(function () {
      var $this   = $(this)
      var data    = $this.data('bs.collapse')
      var options = $.extend({}, Collapse.DEFAULTS, $this.data(), typeof option == 'object' && option)

      if (!data && options.toggle && option == 'show') options.toggle = false
      if (!data) $this.data('bs.collapse', (data = new Collapse(this, options)))
      if (typeof option == 'string') data[option]()
    })
  }

  var old = $.fn.collapse

  $.fn.collapse             = Plugin
  $.fn.collapse.Constructor = Collapse


  // COLLAPSE NO CONFLICT
  // ====================

  $.fn.collapse.noConflict = function () {
    $.fn.collapse = old
    return this
  }


  // COLLAPSE DATA-API
  // =================

  $(document).on('click.bs.collapse.data-api', '[data-toggle="collapse"]', function (e) {
    var $this   = $(this)

    if (!$this.attr('data-target')) e.preventDefault()

    var $target = getTargetFromTrigger($this)
    var data    = $target.data('bs.collapse')
    var option  = data ? 'toggle' : $.extend({}, $this.data(), { trigger: this })

    Plugin.call($target, option)
  })

}(jQuery);

/* ========================================================================
 * Bootstrap: dropdown.js v3.3.2
 * http://getbootstrap.com/javascript/#dropdowns
 * ========================================================================
 * Copyright 2011-2015 Twitter, Inc.
 * Licensed under MIT (https://github.com/twbs/bootstrap/blob/master/LICENSE)
 * ======================================================================== */


+function ($) {
  'use strict';

  // DROPDOWN CLASS DEFINITION
  // =========================

  var backdrop = '.dropdown-backdrop'
  var toggle   = '[data-toggle="dropdown"]'
  var Dropdown = function (element) {
    $(element).on('click.bs.dropdown', this.toggle)
  }

  Dropdown.VERSION = '3.3.2'

  Dropdown.prototype.toggle = function (e) {
    var $this = $(this)

    if ($this.is('.disabled, :disabled')) return

    var $parent  = getParent($this)
    var isActive = $parent.hasClass('open')

    clearMenus()

    if (!isActive) {
      if ('ontouchstart' in document.documentElement && !$parent.closest('.navbar-nav').length) {
        // if mobile we use a backdrop because click events don't delegate
        $('<div class="dropdown-backdrop"/>').insertAfter($(this)).on('click', clearMenus)
      }

      var relatedTarget = { relatedTarget: this }
      $parent.trigger(e = $.Event('show.bs.dropdown', relatedTarget))

      if (e.isDefaultPrevented()) return

      $this
        .trigger('focus')
        .attr('aria-expanded', 'true')

      $parent
        .toggleClass('open')
        .trigger('shown.bs.dropdown', relatedTarget)
    }

    return false
  }

  Dropdown.prototype.keydown = function (e) {
    if (!/(38|40|27|32)/.test(e.which) || /input|textarea/i.test(e.target.tagName)) return

    var $this = $(this)

    e.preventDefault()
    e.stopPropagation()

    if ($this.is('.disabled, :disabled')) return

    var $parent  = getParent($this)
    var isActive = $parent.hasClass('open')

    if ((!isActive && e.which != 27) || (isActive && e.which == 27)) {
      if (e.which == 27) $parent.find(toggle).trigger('focus')
      return $this.trigger('click')
    }

    var desc = ' li:not(.divider):visible a'
    var $items = $parent.find('[role="menu"]' + desc + ', [role="listbox"]' + desc)

    if (!$items.length) return

    var index = $items.index(e.target)

    if (e.which == 38 && index > 0)                 index--                        // up
    if (e.which == 40 && index < $items.length - 1) index++                        // down
    if (!~index)                                      index = 0

    $items.eq(index).trigger('focus')
  }

  function clearMenus(e) {
    if (e && e.which === 3) return
    $(backdrop).remove()
    $(toggle).each(function () {
      var $this         = $(this)
      var $parent       = getParent($this)
      var relatedTarget = { relatedTarget: this }

      if (!$parent.hasClass('open')) return

      $parent.trigger(e = $.Event('hide.bs.dropdown', relatedTarget))

      if (e.isDefaultPrevented()) return

      $this.attr('aria-expanded', 'false')
      $parent.removeClass('open').trigger('hidden.bs.dropdown', relatedTarget)
    })
  }

  function getParent($this) {
    var selector = $this.attr('data-target')

    if (!selector) {
      selector = $this.attr('href')
      selector = selector && /#[A-Za-z]/.test(selector) && selector.replace(/.*(?=#[^\s]*$)/, '') // strip for ie7
    }

    var $parent = selector && $(selector)

    return $parent && $parent.length ? $parent : $this.parent()
  }


  // DROPDOWN PLUGIN DEFINITION
  // ==========================

  function Plugin(option) {
    return this.each(function () {
      var $this = $(this)
      var data  = $this.data('bs.dropdown')

      if (!data) $this.data('bs.dropdown', (data = new Dropdown(this)))
      if (typeof option == 'string') data[option].call($this)
    })
  }

  var old = $.fn.dropdown

  $.fn.dropdown             = Plugin
  $.fn.dropdown.Constructor = Dropdown


  // DROPDOWN NO CONFLICT
  // ====================

  $.fn.dropdown.noConflict = function () {
    $.fn.dropdown = old
    return this
  }


  // APPLY TO STANDARD DROPDOWN ELEMENTS
  // ===================================

  $(document)
    .on('click.bs.dropdown.data-api', clearMenus)
    .on('click.bs.dropdown.data-api', '.dropdown form', function (e) { e.stopPropagation() })
    .on('click.bs.dropdown.data-api', toggle, Dropdown.prototype.toggle)
    .on('keydown.bs.dropdown.data-api', toggle, Dropdown.prototype.keydown)
    .on('keydown.bs.dropdown.data-api', '[role="menu"]', Dropdown.prototype.keydown)
    .on('keydown.bs.dropdown.data-api', '[role="listbox"]', Dropdown.prototype.keydown)

}(jQuery);

/* ========================================================================
 * Bootstrap: modal.js v3.3.2
 * http://getbootstrap.com/javascript/#modals
 * ========================================================================
 * Copyright 2011-2015 Twitter, Inc.
 * Licensed under MIT (https://github.com/twbs/bootstrap/blob/master/LICENSE)
 * ======================================================================== */


+function ($) {
  'use strict';

  // MODAL CLASS DEFINITION
  // ======================

  var Modal = function (element, options) {
    this.options        = options
    this.$body          = $(document.body)
    this.$element       = $(element)
    this.$backdrop      =
    this.isShown        = null
    this.scrollbarWidth = 0

    if (this.options.remote) {
      this.$element
        .find('.modal-content')
        .load(this.options.remote, $.proxy(function () {
          this.$element.trigger('loaded.bs.modal')
        }, this))
    }
  }

  Modal.VERSION  = '3.3.2'

  Modal.TRANSITION_DURATION = 300
  Modal.BACKDROP_TRANSITION_DURATION = 150

  Modal.DEFAULTS = {
    backdrop: true,
    keyboard: true,
    show: true
  }

  Modal.prototype.toggle = function (_relatedTarget) {
    return this.isShown ? this.hide() : this.show(_relatedTarget)
  }

  Modal.prototype.show = function (_relatedTarget) {
    var that = this
    var e    = $.Event('show.bs.modal', { relatedTarget: _relatedTarget })

    this.$element.trigger(e)

    if (this.isShown || e.isDefaultPrevented()) return

    this.isShown = true

    this.checkScrollbar()
    this.setScrollbar()
    this.$body.addClass('modal-open')

    this.escape()
    this.resize()

    this.$element.on('click.dismiss.bs.modal', '[data-dismiss="modal"]', $.proxy(this.hide, this))

    this.backdrop(function () {
      var transition = $.support.transition && that.$element.hasClass('fade')

      if (!that.$element.parent().length) {
        that.$element.appendTo(that.$body) // don't move modals dom position
      }

      that.$element
        .show()
        .scrollTop(0)

      if (that.options.backdrop) that.adjustBackdrop()
      that.adjustDialog()

      if (transition) {
        that.$element[0].offsetWidth // force reflow
      }

      that.$element
        .addClass('in')
        .attr('aria-hidden', false)

      that.enforceFocus()

      var e = $.Event('shown.bs.modal', { relatedTarget: _relatedTarget })

      transition ?
        that.$element.find('.modal-dialog') // wait for modal to slide in
          .one('bsTransitionEnd', function () {
            that.$element.trigger('focus').trigger(e)
          })
          .emulateTransitionEnd(Modal.TRANSITION_DURATION) :
        that.$element.trigger('focus').trigger(e)
    })
  }

  Modal.prototype.hide = function (e) {
    if (e) e.preventDefault()

    e = $.Event('hide.bs.modal')

    this.$element.trigger(e)

    if (!this.isShown || e.isDefaultPrevented()) return

    this.isShown = false

    this.escape()
    this.resize()

    $(document).off('focusin.bs.modal')

    this.$element
      .removeClass('in')
      .attr('aria-hidden', true)
      .off('click.dismiss.bs.modal')

    $.support.transition && this.$element.hasClass('fade') ?
      this.$element
        .one('bsTransitionEnd', $.proxy(this.hideModal, this))
        .emulateTransitionEnd(Modal.TRANSITION_DURATION) :
      this.hideModal()
  }

  Modal.prototype.enforceFocus = function () {
    $(document)
      .off('focusin.bs.modal') // guard against infinite focus loop
      .on('focusin.bs.modal', $.proxy(function (e) {
        if (this.$element[0] !== e.target && !this.$element.has(e.target).length) {
          this.$element.trigger('focus')
        }
      }, this))
  }

  Modal.prototype.escape = function () {
    if (this.isShown && this.options.keyboard) {
      this.$element.on('keydown.dismiss.bs.modal', $.proxy(function (e) {
        e.which == 27 && this.hide()
      }, this))
    } else if (!this.isShown) {
      this.$element.off('keydown.dismiss.bs.modal')
    }
  }

  Modal.prototype.resize = function () {
    if (this.isShown) {
      $(window).on('resize.bs.modal', $.proxy(this.handleUpdate, this))
    } else {
      $(window).off('resize.bs.modal')
    }
  }

  Modal.prototype.hideModal = function () {
    var that = this
    this.$element.hide()
    this.backdrop(function () {
      that.$body.removeClass('modal-open')
      that.resetAdjustments()
      that.resetScrollbar()
      that.$element.trigger('hidden.bs.modal')
    })
  }

  Modal.prototype.removeBackdrop = function () {
    this.$backdrop && this.$backdrop.remove()
    this.$backdrop = null
  }

  Modal.prototype.backdrop = function (callback) {
    var that = this
    var animate = this.$element.hasClass('fade') ? 'fade' : ''

    if (this.isShown && this.options.backdrop) {
      var doAnimate = $.support.transition && animate

      this.$backdrop = $('<div class="modal-backdrop ' + animate + '" />')
        .prependTo(this.$element)
        .on('click.dismiss.bs.modal', $.proxy(function (e) {
          if (e.target !== e.currentTarget) return
          this.options.backdrop == 'static'
            ? this.$element[0].focus.call(this.$element[0])
            : this.hide.call(this)
        }, this))

      if (doAnimate) this.$backdrop[0].offsetWidth // force reflow

      this.$backdrop.addClass('in')

      if (!callback) return

      doAnimate ?
        this.$backdrop
          .one('bsTransitionEnd', callback)
          .emulateTransitionEnd(Modal.BACKDROP_TRANSITION_DURATION) :
        callback()

    } else if (!this.isShown && this.$backdrop) {
      this.$backdrop.removeClass('in')

      var callbackRemove = function () {
        that.removeBackdrop()
        callback && callback()
      }
      $.support.transition && this.$element.hasClass('fade') ?
        this.$backdrop
          .one('bsTransitionEnd', callbackRemove)
          .emulateTransitionEnd(Modal.BACKDROP_TRANSITION_DURATION) :
        callbackRemove()

    } else if (callback) {
      callback()
    }
  }

  // these following methods are used to handle overflowing modals

  Modal.prototype.handleUpdate = function () {
    if (this.options.backdrop) this.adjustBackdrop()
    this.adjustDialog()
  }

  Modal.prototype.adjustBackdrop = function () {
    this.$backdrop
      .css('height', 0)
      .css('height', this.$element[0].scrollHeight)
  }

  Modal.prototype.adjustDialog = function () {
    var modalIsOverflowing = this.$element[0].scrollHeight > document.documentElement.clientHeight

    this.$element.css({
      paddingLeft:  !this.bodyIsOverflowing && modalIsOverflowing ? this.scrollbarWidth : '',
      paddingRight: this.bodyIsOverflowing && !modalIsOverflowing ? this.scrollbarWidth : ''
    })
  }

  Modal.prototype.resetAdjustments = function () {
    this.$element.css({
      paddingLeft: '',
      paddingRight: ''
    })
  }

  Modal.prototype.checkScrollbar = function () {
    this.bodyIsOverflowing = document.body.scrollHeight > document.documentElement.clientHeight
    this.scrollbarWidth = this.measureScrollbar()
  }

  Modal.prototype.setScrollbar = function () {
    var bodyPad = parseInt((this.$body.css('padding-right') || 0), 10)
    if (this.bodyIsOverflowing) this.$body.css('padding-right', bodyPad + this.scrollbarWidth)
  }

  Modal.prototype.resetScrollbar = function () {
    this.$body.css('padding-right', '')
  }

  Modal.prototype.measureScrollbar = function () { // thx walsh
    var scrollDiv = document.createElement('div')
    scrollDiv.className = 'modal-scrollbar-measure'
    this.$body.append(scrollDiv)
    var scrollbarWidth = scrollDiv.offsetWidth - scrollDiv.clientWidth
    this.$body[0].removeChild(scrollDiv)
    return scrollbarWidth
  }


  // MODAL PLUGIN DEFINITION
  // =======================

  function Plugin(option, _relatedTarget) {
    return this.each(function () {
      var $this   = $(this)
      var data    = $this.data('bs.modal')
      var options = $.extend({}, Modal.DEFAULTS, $this.data(), typeof option == 'object' && option)

      if (!data) $this.data('bs.modal', (data = new Modal(this, options)))
      if (typeof option == 'string') data[option](_relatedTarget)
      else if (options.show) data.show(_relatedTarget)
    })
  }

  var old = $.fn.modal

  $.fn.modal             = Plugin
  $.fn.modal.Constructor = Modal


  // MODAL NO CONFLICT
  // =================

  $.fn.modal.noConflict = function () {
    $.fn.modal = old
    return this
  }


  // MODAL DATA-API
  // ==============

  $(document).on('click.bs.modal.data-api', '[data-toggle="modal"]', function (e) {
    var $this   = $(this)
    var href    = $this.attr('href')
    var $target = $($this.attr('data-target') || (href && href.replace(/.*(?=#[^\s]+$)/, ''))) // strip for ie7
    var option  = $target.data('bs.modal') ? 'toggle' : $.extend({ remote: !/#/.test(href) && href }, $target.data(), $this.data())

    if ($this.is('a')) e.preventDefault()

    $target.one('show.bs.modal', function (showEvent) {
      if (showEvent.isDefaultPrevented()) return // only register focus restorer if modal will actually get shown
      $target.one('hidden.bs.modal', function () {
        $this.is(':visible') && $this.trigger('focus')
      })
    })
    Plugin.call($target, option, this)
  })

}(jQuery);

/* ========================================================================
 * Bootstrap: tooltip.js v3.3.2
 * http://getbootstrap.com/javascript/#tooltip
 * Inspired by the original jQuery.tipsy by Jason Frame
 * ========================================================================
 * Copyright 2011-2015 Twitter, Inc.
 * Licensed under MIT (https://github.com/twbs/bootstrap/blob/master/LICENSE)
 * ======================================================================== */


+function ($) {
  'use strict';

  // TOOLTIP PUBLIC CLASS DEFINITION
  // ===============================

  var Tooltip = function (element, options) {
    this.type       =
    this.options    =
    this.enabled    =
    this.timeout    =
    this.hoverState =
    this.$element   = null

    this.init('tooltip', element, options)
  }

  Tooltip.VERSION  = '3.3.2'

  Tooltip.TRANSITION_DURATION = 150

  Tooltip.DEFAULTS = {
    animation: true,
    placement: 'top',
    selector: false,
    template: '<div class="tooltip" role="tooltip"><div class="tooltip-arrow"></div><div class="tooltip-inner"></div></div>',
    trigger: 'hover focus',
    title: '',
    delay: 0,
    html: false,
    container: false,
    viewport: {
      selector: 'body',
      padding: 0
    }
  }

  Tooltip.prototype.init = function (type, element, options) {
    this.enabled   = true
    this.type      = type
    this.$element  = $(element)
    this.options   = this.getOptions(options)
    this.$viewport = this.options.viewport && $(this.options.viewport.selector || this.options.viewport)

    var triggers = this.options.trigger.split(' ')

    for (var i = triggers.length; i--;) {
      var trigger = triggers[i]

      if (trigger == 'click') {
        this.$element.on('click.' + this.type, this.options.selector, $.proxy(this.toggle, this))
      } else if (trigger != 'manual') {
        var eventIn  = trigger == 'hover' ? 'mouseenter' : 'focusin'
        var eventOut = trigger == 'hover' ? 'mouseleave' : 'focusout'

        this.$element.on(eventIn  + '.' + this.type, this.options.selector, $.proxy(this.enter, this))
        this.$element.on(eventOut + '.' + this.type, this.options.selector, $.proxy(this.leave, this))
      }
    }

    this.options.selector ?
      (this._options = $.extend({}, this.options, { trigger: 'manual', selector: '' })) :
      this.fixTitle()
  }

  Tooltip.prototype.getDefaults = function () {
    return Tooltip.DEFAULTS
  }

  Tooltip.prototype.getOptions = function (options) {
    options = $.extend({}, this.getDefaults(), this.$element.data(), options)

    if (options.delay && typeof options.delay == 'number') {
      options.delay = {
        show: options.delay,
        hide: options.delay
      }
    }

    return options
  }

  Tooltip.prototype.getDelegateOptions = function () {
    var options  = {}
    var defaults = this.getDefaults()

    this._options && $.each(this._options, function (key, value) {
      if (defaults[key] != value) options[key] = value
    })

    return options
  }

  Tooltip.prototype.enter = function (obj) {
    var self = obj instanceof this.constructor ?
      obj : $(obj.currentTarget).data('bs.' + this.type)

    if (self && self.$tip && self.$tip.is(':visible')) {
      self.hoverState = 'in'
      return
    }

    if (!self) {
      self = new this.constructor(obj.currentTarget, this.getDelegateOptions())
      $(obj.currentTarget).data('bs.' + this.type, self)
    }

    clearTimeout(self.timeout)

    self.hoverState = 'in'

    if (!self.options.delay || !self.options.delay.show) return self.show()

    self.timeout = setTimeout(function () {
      if (self.hoverState == 'in') self.show()
    }, self.options.delay.show)
  }

  Tooltip.prototype.leave = function (obj) {
    var self = obj instanceof this.constructor ?
      obj : $(obj.currentTarget).data('bs.' + this.type)

    if (!self) {
      self = new this.constructor(obj.currentTarget, this.getDelegateOptions())
      $(obj.currentTarget).data('bs.' + this.type, self)
    }

    clearTimeout(self.timeout)

    self.hoverState = 'out'

    if (!self.options.delay || !self.options.delay.hide) return self.hide()

    self.timeout = setTimeout(function () {
      if (self.hoverState == 'out') self.hide()
    }, self.options.delay.hide)
  }

  Tooltip.prototype.show = function () {
    var e = $.Event('show.bs.' + this.type)

    if (this.hasContent() && this.enabled) {
      this.$element.trigger(e)

      var inDom = $.contains(this.$element[0].ownerDocument.documentElement, this.$element[0])
      if (e.isDefaultPrevented() || !inDom) return
      var that = this

      var $tip = this.tip()

      var tipId = this.getUID(this.type)

      this.setContent()
      $tip.attr('id', tipId)
      this.$element.attr('aria-describedby', tipId)

      if (this.options.animation) $tip.addClass('fade')

      var placement = typeof this.options.placement == 'function' ?
        this.options.placement.call(this, $tip[0], this.$element[0]) :
        this.options.placement

      var autoToken = /\s?auto?\s?/i
      var autoPlace = autoToken.test(placement)
      if (autoPlace) placement = placement.replace(autoToken, '') || 'top'

      $tip
        .detach()
        .css({ top: 0, left: 0, display: 'block' })
        .addClass(placement)
        .data('bs.' + this.type, this)

      this.options.container ? $tip.appendTo(this.options.container) : $tip.insertAfter(this.$element)

      var pos          = this.getPosition()
      var actualWidth  = $tip[0].offsetWidth
      var actualHeight = $tip[0].offsetHeight

      if (autoPlace) {
        var orgPlacement = placement
        var $container   = this.options.container ? $(this.options.container) : this.$element.parent()
        var containerDim = this.getPosition($container)

        placement = placement == 'bottom' && pos.bottom + actualHeight > containerDim.bottom ? 'top'    :
                    placement == 'top'    && pos.top    - actualHeight < containerDim.top    ? 'bottom' :
                    placement == 'right'  && pos.right  + actualWidth  > containerDim.width  ? 'left'   :
                    placement == 'left'   && pos.left   - actualWidth  < containerDim.left   ? 'right'  :
                    placement

        $tip
          .removeClass(orgPlacement)
          .addClass(placement)
      }

      var calculatedOffset = this.getCalculatedOffset(placement, pos, actualWidth, actualHeight)

      this.applyPlacement(calculatedOffset, placement)

      var complete = function () {
        var prevHoverState = that.hoverState
        that.$element.trigger('shown.bs.' + that.type)
        that.hoverState = null

        if (prevHoverState == 'out') that.leave(that)
      }

      $.support.transition && this.$tip.hasClass('fade') ?
        $tip
          .one('bsTransitionEnd', complete)
          .emulateTransitionEnd(Tooltip.TRANSITION_DURATION) :
        complete()
    }
  }

  Tooltip.prototype.applyPlacement = function (offset, placement) {
    var $tip   = this.tip()
    var width  = $tip[0].offsetWidth
    var height = $tip[0].offsetHeight

    // manually read margins because getBoundingClientRect includes difference
    var marginTop = parseInt($tip.css('margin-top'), 10)
    var marginLeft = parseInt($tip.css('margin-left'), 10)

    // we must check for NaN for ie 8/9
    if (isNaN(marginTop))  marginTop  = 0
    if (isNaN(marginLeft)) marginLeft = 0

    offset.top  = offset.top  + marginTop
    offset.left = offset.left + marginLeft

    // $.fn.offset doesn't round pixel values
    // so we use setOffset directly with our own function B-0
    $.offset.setOffset($tip[0], $.extend({
      using: function (props) {
        $tip.css({
          top: Math.round(props.top),
          left: Math.round(props.left)
        })
      }
    }, offset), 0)

    $tip.addClass('in')

    // check to see if placing tip in new offset caused the tip to resize itself
    var actualWidth  = $tip[0].offsetWidth
    var actualHeight = $tip[0].offsetHeight

    if (placement == 'top' && actualHeight != height) {
      offset.top = offset.top + height - actualHeight
    }

    var delta = this.getViewportAdjustedDelta(placement, offset, actualWidth, actualHeight)

    if (delta.left) offset.left += delta.left
    else offset.top += delta.top

    var isVertical          = /top|bottom/.test(placement)
    var arrowDelta          = isVertical ? delta.left * 2 - width + actualWidth : delta.top * 2 - height + actualHeight
    var arrowOffsetPosition = isVertical ? 'offsetWidth' : 'offsetHeight'

    $tip.offset(offset)
    this.replaceArrow(arrowDelta, $tip[0][arrowOffsetPosition], isVertical)
  }

  Tooltip.prototype.replaceArrow = function (delta, dimension, isHorizontal) {
    this.arrow()
      .css(isHorizontal ? 'left' : 'top', 50 * (1 - delta / dimension) + '%')
      .css(isHorizontal ? 'top' : 'left', '')
  }

  Tooltip.prototype.setContent = function () {
    var $tip  = this.tip()
    var title = this.getTitle()

    $tip.find('.tooltip-inner')[this.options.html ? 'html' : 'text'](title)
    $tip.removeClass('fade in top bottom left right')
  }

  Tooltip.prototype.hide = function (callback) {
    var that = this
    var $tip = this.tip()
    var e    = $.Event('hide.bs.' + this.type)

    function complete() {
      if (that.hoverState != 'in') $tip.detach()
      that.$element
        .removeAttr('aria-describedby')
        .trigger('hidden.bs.' + that.type)
      callback && callback()
    }

    this.$element.trigger(e)

    if (e.isDefaultPrevented()) return

    $tip.removeClass('in')

    $.support.transition && this.$tip.hasClass('fade') ?
      $tip
        .one('bsTransitionEnd', complete)
        .emulateTransitionEnd(Tooltip.TRANSITION_DURATION) :
      complete()

    this.hoverState = null

    return this
  }

  Tooltip.prototype.fixTitle = function () {
    var $e = this.$element
    if ($e.attr('title') || typeof ($e.attr('data-original-title')) != 'string') {
      $e.attr('data-original-title', $e.attr('title') || '').attr('title', '')
    }
  }

  Tooltip.prototype.hasContent = function () {
    return this.getTitle()
  }

  Tooltip.prototype.getPosition = function ($element) {
    $element   = $element || this.$element

    var el     = $element[0]
    var isBody = el.tagName == 'BODY'

    var elRect    = el.getBoundingClientRect()
    if (elRect.width == null) {
      // width and height are missing in IE8, so compute them manually; see https://github.com/twbs/bootstrap/issues/14093
      elRect = $.extend({}, elRect, { width: elRect.right - elRect.left, height: elRect.bottom - elRect.top })
    }
    var elOffset  = isBody ? { top: 0, left: 0 } : $element.offset()
    var scroll    = { scroll: isBody ? document.documentElement.scrollTop || document.body.scrollTop : $element.scrollTop() }
    var outerDims = isBody ? { width: $(window).width(), height: $(window).height() } : null

    return $.extend({}, elRect, scroll, outerDims, elOffset)
  }

  Tooltip.prototype.getCalculatedOffset = function (placement, pos, actualWidth, actualHeight) {
    return placement == 'bottom' ? { top: pos.top + pos.height,   left: pos.left + pos.width / 2 - actualWidth / 2 } :
           placement == 'top'    ? { top: pos.top - actualHeight, left: pos.left + pos.width / 2 - actualWidth / 2 } :
           placement == 'left'   ? { top: pos.top + pos.height / 2 - actualHeight / 2, left: pos.left - actualWidth } :
        /* placement == 'right' */ { top: pos.top + pos.height / 2 - actualHeight / 2, left: pos.left + pos.width }

  }

  Tooltip.prototype.getViewportAdjustedDelta = function (placement, pos, actualWidth, actualHeight) {
    var delta = { top: 0, left: 0 }
    if (!this.$viewport) return delta

    var viewportPadding = this.options.viewport && this.options.viewport.padding || 0
    var viewportDimensions = this.getPosition(this.$viewport)

    if (/right|left/.test(placement)) {
      var topEdgeOffset    = pos.top - viewportPadding - viewportDimensions.scroll
      var bottomEdgeOffset = pos.top + viewportPadding - viewportDimensions.scroll + actualHeight
      if (topEdgeOffset < viewportDimensions.top) { // top overflow
        delta.top = viewportDimensions.top - topEdgeOffset
      } else if (bottomEdgeOffset > viewportDimensions.top + viewportDimensions.height) { // bottom overflow
        delta.top = viewportDimensions.top + viewportDimensions.height - bottomEdgeOffset
      }
    } else {
      var leftEdgeOffset  = pos.left - viewportPadding
      var rightEdgeOffset = pos.left + viewportPadding + actualWidth
      if (leftEdgeOffset < viewportDimensions.left) { // left overflow
        delta.left = viewportDimensions.left - leftEdgeOffset
      } else if (rightEdgeOffset > viewportDimensions.width) { // right overflow
        delta.left = viewportDimensions.left + viewportDimensions.width - rightEdgeOffset
      }
    }

    return delta
  }

  Tooltip.prototype.getTitle = function () {
    var title
    var $e = this.$element
    var o  = this.options

    title = $e.attr('data-original-title')
      || (typeof o.title == 'function' ? o.title.call($e[0]) :  o.title)

    return title
  }

  Tooltip.prototype.getUID = function (prefix) {
    do prefix += ~~(Math.random() * 1000000)
    while (document.getElementById(prefix))
    return prefix
  }

  Tooltip.prototype.tip = function () {
    return (this.$tip = this.$tip || $(this.options.template))
  }

  Tooltip.prototype.arrow = function () {
    return (this.$arrow = this.$arrow || this.tip().find('.tooltip-arrow'))
  }

  Tooltip.prototype.enable = function () {
    this.enabled = true
  }

  Tooltip.prototype.disable = function () {
    this.enabled = false
  }

  Tooltip.prototype.toggleEnabled = function () {
    this.enabled = !this.enabled
  }

  Tooltip.prototype.toggle = function (e) {
    var self = this
    if (e) {
      self = $(e.currentTarget).data('bs.' + this.type)
      if (!self) {
        self = new this.constructor(e.currentTarget, this.getDelegateOptions())
        $(e.currentTarget).data('bs.' + this.type, self)
      }
    }

    self.tip().hasClass('in') ? self.leave(self) : self.enter(self)
  }

  Tooltip.prototype.destroy = function () {
    var that = this
    clearTimeout(this.timeout)
    this.hide(function () {
      that.$element.off('.' + that.type).removeData('bs.' + that.type)
    })
  }


  // TOOLTIP PLUGIN DEFINITION
  // =========================

  function Plugin(option) {
    return this.each(function () {
      var $this   = $(this)
      var data    = $this.data('bs.tooltip')
      var options = typeof option == 'object' && option

      if (!data && option == 'destroy') return
      if (!data) $this.data('bs.tooltip', (data = new Tooltip(this, options)))
      if (typeof option == 'string') data[option]()
    })
  }

  var old = $.fn.tooltip

  $.fn.tooltip             = Plugin
  $.fn.tooltip.Constructor = Tooltip


  // TOOLTIP NO CONFLICT
  // ===================

  $.fn.tooltip.noConflict = function () {
    $.fn.tooltip = old
    return this
  }

}(jQuery);

/* ========================================================================
 * Bootstrap: popover.js v3.3.2
 * http://getbootstrap.com/javascript/#popovers
 * ========================================================================
 * Copyright 2011-2015 Twitter, Inc.
 * Licensed under MIT (https://github.com/twbs/bootstrap/blob/master/LICENSE)
 * ======================================================================== */


+function ($) {
  'use strict';

  // POPOVER PUBLIC CLASS DEFINITION
  // ===============================

  var Popover = function (element, options) {
    this.init('popover', element, options)
  }

  if (!$.fn.tooltip) throw new Error('Popover requires tooltip.js')

  Popover.VERSION  = '3.3.2'

  Popover.DEFAULTS = $.extend({}, $.fn.tooltip.Constructor.DEFAULTS, {
    placement: 'right',
    trigger: 'click',
    content: '',
    template: '<div class="popover" role="tooltip"><div class="arrow"></div><h3 class="popover-title"></h3><div class="popover-content"></div></div>'
  })


  // NOTE: POPOVER EXTENDS tooltip.js
  // ================================

  Popover.prototype = $.extend({}, $.fn.tooltip.Constructor.prototype)

  Popover.prototype.constructor = Popover

  Popover.prototype.getDefaults = function () {
    return Popover.DEFAULTS
  }

  Popover.prototype.setContent = function () {
    var $tip    = this.tip()
    var title   = this.getTitle()
    var content = this.getContent()

    $tip.find('.popover-title')[this.options.html ? 'html' : 'text'](title)
    $tip.find('.popover-content').children().detach().end()[ // we use append for html objects to maintain js events
      this.options.html ? (typeof content == 'string' ? 'html' : 'append') : 'text'
    ](content)

    $tip.removeClass('fade top bottom left right in')

    // IE8 doesn't accept hiding via the `:empty` pseudo selector, we have to do
    // this manually by checking the contents.
    if (!$tip.find('.popover-title').html()) $tip.find('.popover-title').hide()
  }

  Popover.prototype.hasContent = function () {
    return this.getTitle() || this.getContent()
  }

  Popover.prototype.getContent = function () {
    var $e = this.$element
    var o  = this.options

    return $e.attr('data-content')
      || (typeof o.content == 'function' ?
            o.content.call($e[0]) :
            o.content)
  }

  Popover.prototype.arrow = function () {
    return (this.$arrow = this.$arrow || this.tip().find('.arrow'))
  }

  Popover.prototype.tip = function () {
    if (!this.$tip) this.$tip = $(this.options.template)
    return this.$tip
  }


  // POPOVER PLUGIN DEFINITION
  // =========================

  function Plugin(option) {
    return this.each(function () {
      var $this   = $(this)
      var data    = $this.data('bs.popover')
      var options = typeof option == 'object' && option

      if (!data && option == 'destroy') return
      if (!data) $this.data('bs.popover', (data = new Popover(this, options)))
      if (typeof option == 'string') data[option]()
    })
  }

  var old = $.fn.popover

  $.fn.popover             = Plugin
  $.fn.popover.Constructor = Popover


  // POPOVER NO CONFLICT
  // ===================

  $.fn.popover.noConflict = function () {
    $.fn.popover = old
    return this
  }

}(jQuery);

/* ========================================================================
 * Bootstrap: scrollspy.js v3.3.2
 * http://getbootstrap.com/javascript/#scrollspy
 * ========================================================================
 * Copyright 2011-2015 Twitter, Inc.
 * Licensed under MIT (https://github.com/twbs/bootstrap/blob/master/LICENSE)
 * ======================================================================== */


+function ($) {
  'use strict';

  // SCROLLSPY CLASS DEFINITION
  // ==========================

  function ScrollSpy(element, options) {
    var process  = $.proxy(this.process, this)

    this.$body          = $('body')
    this.$scrollElement = $(element).is('body') ? $(window) : $(element)
    this.options        = $.extend({}, ScrollSpy.DEFAULTS, options)
    this.selector       = (this.options.target || '') + ' .nav li > a'
    this.offsets        = []
    this.targets        = []
    this.activeTarget   = null
    this.scrollHeight   = 0

    this.$scrollElement.on('scroll.bs.scrollspy', process)
    this.refresh()
    this.process()
  }

  ScrollSpy.VERSION  = '3.3.2'

  ScrollSpy.DEFAULTS = {
    offset: 10
  }

  ScrollSpy.prototype.getScrollHeight = function () {
    return this.$scrollElement[0].scrollHeight || Math.max(this.$body[0].scrollHeight, document.documentElement.scrollHeight)
  }

  ScrollSpy.prototype.refresh = function () {
    var offsetMethod = 'offset'
    var offsetBase   = 0

    if (!$.isWindow(this.$scrollElement[0])) {
      offsetMethod = 'position'
      offsetBase   = this.$scrollElement.scrollTop()
    }

    this.offsets = []
    this.targets = []
    this.scrollHeight = this.getScrollHeight()

    var self     = this

    this.$body
      .find(this.selector)
      .map(function () {
        var $el   = $(this)
        var href  = $el.data('target') || $el.attr('href')
        var $href = /^#./.test(href) && $(href)

        return ($href
          && $href.length
          && $href.is(':visible')
          && [[$href[offsetMethod]().top + offsetBase, href]]) || null
      })
      .sort(function (a, b) { return a[0] - b[0] })
      .each(function () {
        self.offsets.push(this[0])
        self.targets.push(this[1])
      })
  }

  ScrollSpy.prototype.process = function () {
    var scrollTop    = this.$scrollElement.scrollTop() + this.options.offset
    var scrollHeight = this.getScrollHeight()
    var maxScroll    = this.options.offset + scrollHeight - this.$scrollElement.height()
    var offsets      = this.offsets
    var targets      = this.targets
    var activeTarget = this.activeTarget
    var i

    if (this.scrollHeight != scrollHeight) {
      this.refresh()
    }

    if (scrollTop >= maxScroll) {
      return activeTarget != (i = targets[targets.length - 1]) && this.activate(i)
    }

    if (activeTarget && scrollTop < offsets[0]) {
      this.activeTarget = null
      return this.clear()
    }

    for (i = offsets.length; i--;) {
      activeTarget != targets[i]
        && scrollTop >= offsets[i]
        && (!offsets[i + 1] || scrollTop <= offsets[i + 1])
        && this.activate(targets[i])
    }
  }

  ScrollSpy.prototype.activate = function (target) {
    this.activeTarget = target

    this.clear()

    var selector = this.selector +
        '[data-target="' + target + '"],' +
        this.selector + '[href="' + target + '"]'

    var active = $(selector)
      .parents('li')
      .addClass('active')

    if (active.parent('.dropdown-menu').length) {
      active = active
        .closest('li.dropdown')
        .addClass('active')
    }

    active.trigger('activate.bs.scrollspy')
  }

  ScrollSpy.prototype.clear = function () {
    $(this.selector)
      .parentsUntil(this.options.target, '.active')
      .removeClass('active')
  }


  // SCROLLSPY PLUGIN DEFINITION
  // ===========================

  function Plugin(option) {
    return this.each(function () {
      var $this   = $(this)
      var data    = $this.data('bs.scrollspy')
      var options = typeof option == 'object' && option

      if (!data) $this.data('bs.scrollspy', (data = new ScrollSpy(this, options)))
      if (typeof option == 'string') data[option]()
    })
  }

  var old = $.fn.scrollspy

  $.fn.scrollspy             = Plugin
  $.fn.scrollspy.Constructor = ScrollSpy


  // SCROLLSPY NO CONFLICT
  // =====================

  $.fn.scrollspy.noConflict = function () {
    $.fn.scrollspy = old
    return this
  }


  // SCROLLSPY DATA-API
  // ==================

  $(window).on('load.bs.scrollspy.data-api', function () {
    $('[data-spy="scroll"]').each(function () {
      var $spy = $(this)
      Plugin.call($spy, $spy.data())
    })
  })

}(jQuery);

/* ========================================================================
 * Bootstrap: tab.js v3.3.2
 * http://getbootstrap.com/javascript/#tabs
 * ========================================================================
 * Copyright 2011-2015 Twitter, Inc.
 * Licensed under MIT (https://github.com/twbs/bootstrap/blob/master/LICENSE)
 * ======================================================================== */


+function ($) {
  'use strict';

  // TAB CLASS DEFINITION
  // ====================

  var Tab = function (element) {
    this.element = $(element)
  }

  Tab.VERSION = '3.3.2'

  Tab.TRANSITION_DURATION = 150

  Tab.prototype.show = function () {
    var $this    = this.element
    var $ul      = $this.closest('ul:not(.dropdown-menu)')
    var selector = $this.data('target')

    if (!selector) {
      selector = $this.attr('href')
      selector = selector && selector.replace(/.*(?=#[^\s]*$)/, '') // strip for ie7
    }

    if ($this.parent('li').hasClass('active')) return

    var $previous = $ul.find('.active:last a')
    var hideEvent = $.Event('hide.bs.tab', {
      relatedTarget: $this[0]
    })
    var showEvent = $.Event('show.bs.tab', {
      relatedTarget: $previous[0]
    })

    $previous.trigger(hideEvent)
    $this.trigger(showEvent)

    if (showEvent.isDefaultPrevented() || hideEvent.isDefaultPrevented()) return

    var $target = $(selector)

    this.activate($this.closest('li'), $ul)
    this.activate($target, $target.parent(), function () {
      $previous.trigger({
        type: 'hidden.bs.tab',
        relatedTarget: $this[0]
      })
      $this.trigger({
        type: 'shown.bs.tab',
        relatedTarget: $previous[0]
      })
    })
  }

  Tab.prototype.activate = function (element, container, callback) {
    var $active    = container.find('> .active')
    var transition = callback
      && $.support.transition
      && (($active.length && $active.hasClass('fade')) || !!container.find('> .fade').length)

    function next() {
      $active
        .removeClass('active')
        .find('> .dropdown-menu > .active')
          .removeClass('active')
        .end()
        .find('[data-toggle="tab"]')
          .attr('aria-expanded', false)

      element
        .addClass('active')
        .find('[data-toggle="tab"]')
          .attr('aria-expanded', true)

      if (transition) {
        element[0].offsetWidth // reflow for transition
        element.addClass('in')
      } else {
        element.removeClass('fade')
      }

      if (element.parent('.dropdown-menu')) {
        element
          .closest('li.dropdown')
            .addClass('active')
          .end()
          .find('[data-toggle="tab"]')
            .attr('aria-expanded', true)
      }

      callback && callback()
    }

    $active.length && transition ?
      $active
        .one('bsTransitionEnd', next)
        .emulateTransitionEnd(Tab.TRANSITION_DURATION) :
      next()

    $active.removeClass('in')
  }


  // TAB PLUGIN DEFINITION
  // =====================

  function Plugin(option) {
    return this.each(function () {
      var $this = $(this)
      var data  = $this.data('bs.tab')

      if (!data) $this.data('bs.tab', (data = new Tab(this)))
      if (typeof option == 'string') data[option]()
    })
  }

  var old = $.fn.tab

  $.fn.tab             = Plugin
  $.fn.tab.Constructor = Tab


  // TAB NO CONFLICT
  // ===============

  $.fn.tab.noConflict = function () {
    $.fn.tab = old
    return this
  }


  // TAB DATA-API
  // ============

  var clickHandler = function (e) {
    e.preventDefault()
    Plugin.call($(this), 'show')
  }

  $(document)
    .on('click.bs.tab.data-api', '[data-toggle="tab"]', clickHandler)
    .on('click.bs.tab.data-api', '[data-toggle="pill"]', clickHandler)

}(jQuery);

/* ========================================================================
 * Bootstrap: affix.js v3.3.2
 * http://getbootstrap.com/javascript/#affix
 * ========================================================================
 * Copyright 2011-2015 Twitter, Inc.
 * Licensed under MIT (https://github.com/twbs/bootstrap/blob/master/LICENSE)
 * ======================================================================== */


+function ($) {
  'use strict';

  // AFFIX CLASS DEFINITION
  // ======================

  var Affix = function (element, options) {
    this.options = $.extend({}, Affix.DEFAULTS, options)

    this.$target = $(this.options.target)
      .on('scroll.bs.affix.data-api', $.proxy(this.checkPosition, this))
      .on('click.bs.affix.data-api',  $.proxy(this.checkPositionWithEventLoop, this))

    this.$element     = $(element)
    this.affixed      =
    this.unpin        =
    this.pinnedOffset = null

    this.checkPosition()
  }

  Affix.VERSION  = '3.3.2'

  Affix.RESET    = 'affix affix-top affix-bottom'

  Affix.DEFAULTS = {
    offset: 0,
    target: window
  }

  Affix.prototype.getState = function (scrollHeight, height, offsetTop, offsetBottom) {
    var scrollTop    = this.$target.scrollTop()
    var position     = this.$element.offset()
    var targetHeight = this.$target.height()

    if (offsetTop != null && this.affixed == 'top') return scrollTop < offsetTop ? 'top' : false

    if (this.affixed == 'bottom') {
      if (offsetTop != null) return (scrollTop + this.unpin <= position.top) ? false : 'bottom'
      return (scrollTop + targetHeight <= scrollHeight - offsetBottom) ? false : 'bottom'
    }

    var initializing   = this.affixed == null
    var colliderTop    = initializing ? scrollTop : position.top
    var colliderHeight = initializing ? targetHeight : height

    if (offsetTop != null && scrollTop <= offsetTop) return 'top'
    if (offsetBottom != null && (colliderTop + colliderHeight >= scrollHeight - offsetBottom)) return 'bottom'

    return false
  }

  Affix.prototype.getPinnedOffset = function () {
    if (this.pinnedOffset) return this.pinnedOffset
    this.$element.removeClass(Affix.RESET).addClass('affix')
    var scrollTop = this.$target.scrollTop()
    var position  = this.$element.offset()
    return (this.pinnedOffset = position.top - scrollTop)
  }

  Affix.prototype.checkPositionWithEventLoop = function () {
    setTimeout($.proxy(this.checkPosition, this), 1)
  }

  Affix.prototype.checkPosition = function () {
    if (!this.$element.is(':visible')) return

    var height       = this.$element.height()
    var offset       = this.options.offset
    var offsetTop    = offset.top
    var offsetBottom = offset.bottom
    var scrollHeight = $('body').height()

    if (typeof offset != 'object')         offsetBottom = offsetTop = offset
    if (typeof offsetTop == 'function')    offsetTop    = offset.top(this.$element)
    if (typeof offsetBottom == 'function') offsetBottom = offset.bottom(this.$element)

    var affix = this.getState(scrollHeight, height, offsetTop, offsetBottom)

    if (this.affixed != affix) {
      if (this.unpin != null) this.$element.css('top', '')

      var affixType = 'affix' + (affix ? '-' + affix : '')
      var e         = $.Event(affixType + '.bs.affix')

      this.$element.trigger(e)

      if (e.isDefaultPrevented()) return

      this.affixed = affix
      this.unpin = affix == 'bottom' ? this.getPinnedOffset() : null

      this.$element
        .removeClass(Affix.RESET)
        .addClass(affixType)
        .trigger(affixType.replace('affix', 'affixed') + '.bs.affix')
    }

    if (affix == 'bottom') {
      this.$element.offset({
        top: scrollHeight - height - offsetBottom
      })
    }
  }


  // AFFIX PLUGIN DEFINITION
  // =======================

  function Plugin(option) {
    return this.each(function () {
      var $this   = $(this)
      var data    = $this.data('bs.affix')
      var options = typeof option == 'object' && option

      if (!data) $this.data('bs.affix', (data = new Affix(this, options)))
      if (typeof option == 'string') data[option]()
    })
  }

  var old = $.fn.affix

  $.fn.affix             = Plugin
  $.fn.affix.Constructor = Affix


  // AFFIX NO CONFLICT
  // =================

  $.fn.affix.noConflict = function () {
    $.fn.affix = old
    return this
  }


  // AFFIX DATA-API
  // ==============

  $(window).on('load', function () {
    $('[data-spy="affix"]').each(function () {
      var $spy = $(this)
      var data = $spy.data()

      data.offset = data.offset || {}

      if (data.offsetBottom != null) data.offset.bottom = data.offsetBottom
      if (data.offsetTop    != null) data.offset.top    = data.offsetTop

      Plugin.call($spy, data)
    })
  })

}(jQuery);
/**
 * Super simple wysiwyg editor on Bootstrap v0.6.1
 * http://summernote.org/
 *
 * summernote.js
 * Copyright 2013-2015 Alan Hong. and other contributors
 * summernote may be freely distributed under the MIT license./
 *
 * Date: 2015-02-08T09:50Z
 */

(function (factory) {
  /* global define */
  if (typeof define === 'function' && define.amd) {
    // AMD. Register as an anonymous module.
    define(['jquery'], factory);
  } else {
    // Browser globals: jQuery
    factory(window.jQuery);
  }
}(function ($) {
  


  if (!Array.prototype.reduce) {
    /**
     * Array.prototype.reduce polyfill
     *
     * @param {Function} callback
     * @param {Value} [initialValue]
     * @return {Value}
     *
     * @see http://goo.gl/WNriQD
     */
    Array.prototype.reduce = function (callback) {
      var t = Object(this), len = t.length >>> 0, k = 0, value;
      if (arguments.length === 2) {
        value = arguments[1];
      } else {
        while (k < len && !(k in t)) {
          k++;
        }
        if (k >= len) {
          throw new TypeError('Reduce of empty array with no initial value');
        }
        value = t[k++];
      }
      for (; k < len; k++) {
        if (k in t) {
          value = callback(value, t[k], k, t);
        }
      }
      return value;
    };
  }

  if ('function' !== typeof Array.prototype.filter) {
    /**
     * Array.prototype.filter polyfill
     *
     * @param {Function} func
     * @return {Array}
     *
     * @see http://goo.gl/T1KFnq
     */
    Array.prototype.filter = function (func) {
      var t = Object(this), len = t.length >>> 0;

      var res = [];
      var thisArg = arguments.length >= 2 ? arguments[1] : void 0;
      for (var i = 0; i < len; i++) {
        if (i in t) {
          var val = t[i];
          if (func.call(thisArg, val, i, t)) {
            res.push(val);
          }
        }
      }
  
      return res;
    };
  }

  var isSupportAmd = typeof define === 'function' && define.amd;

  /**
   * returns whether font is installed or not.
   *
   * @param {String} fontName
   * @return {Boolean}
   */
  var isFontInstalled = function (fontName) {
    var testFontName = fontName === 'Comic Sans MS' ? 'Courier New' : 'Comic Sans MS';
    var $tester = $('<div>').css({
      position: 'absolute',
      left: '-9999px',
      top: '-9999px',
      fontSize: '200px'
    }).text('mmmmmmmmmwwwwwww').appendTo(document.body);

    var originalWidth = $tester.css('fontFamily', testFontName).width();
    var width = $tester.css('fontFamily', fontName + ',' + testFontName).width();

    $tester.remove();

    return originalWidth !== width;
  };

  /**
   * @class core.agent
   *
   * Object which check platform and agent
   *
   * @singleton
   * @alternateClassName agent
   */
  var agent = {
    /** @property {Boolean} [isMac=false] true if this agent is Mac  */
    isMac: navigator.appVersion.indexOf('Mac') > -1,
    /** @property {Boolean} [isMSIE=false] true if this agent is a Internet Explorer  */
    isMSIE: navigator.userAgent.indexOf('MSIE') > -1 || navigator.userAgent.indexOf('Trident') > -1,
    /** @property {Boolean} [isFF=false] true if this agent is a Firefox  */
    isFF: navigator.userAgent.indexOf('Firefox') > -1,
    /** @property {String} jqueryVersion current jQuery version string  */
    jqueryVersion: parseFloat($.fn.jquery),
    isSupportAmd: isSupportAmd,
    hasCodeMirror: isSupportAmd ? require.specified('CodeMirror') : !!window.CodeMirror,
    isFontInstalled: isFontInstalled,
    isW3CRangeSupport: !!document.createRange
  };

  /**
   * @class core.func
   *
   * func utils (for high-order func's arg)
   *
   * @singleton
   * @alternateClassName func
   */
  var func = (function () {
    var eq = function (itemA) {
      return function (itemB) {
        return itemA === itemB;
      };
    };

    var eq2 = function (itemA, itemB) {
      return itemA === itemB;
    };

    var peq2 = function (propName) {
      return function (itemA, itemB) {
        return itemA[propName] === itemB[propName];
      };
    };

    var ok = function () {
      return true;
    };

    var fail = function () {
      return false;
    };

    var not = function (f) {
      return function () {
        return !f.apply(f, arguments);
      };
    };

    var and = function (fA, fB) {
      return function (item) {
        return fA(item) && fB(item);
      };
    };

    var self = function (a) {
      return a;
    };

    var idCounter = 0;

    /**
     * generate a globally-unique id
     *
     * @param {String} [prefix]
     */
    var uniqueId = function (prefix) {
      var id = ++idCounter + '';
      return prefix ? prefix + id : id;
    };

    /**
     * returns bnd (bounds) from rect
     *
     * - IE Compatability Issue: http://goo.gl/sRLOAo
     * - Scroll Issue: http://goo.gl/sNjUc
     *
     * @param {Rect} rect
     * @return {Object} bounds
     * @return {Number} bounds.top
     * @return {Number} bounds.left
     * @return {Number} bounds.width
     * @return {Number} bounds.height
     */
    var rect2bnd = function (rect) {
      var $document = $(document);
      return {
        top: rect.top + $document.scrollTop(),
        left: rect.left + $document.scrollLeft(),
        width: rect.right - rect.left,
        height: rect.bottom - rect.top
      };
    };

    /**
     * returns a copy of the object where the keys have become the values and the values the keys.
     * @param {Object} obj
     * @return {Object}
     */
    var invertObject = function (obj) {
      var inverted = {};
      for (var key in obj) {
        if (obj.hasOwnProperty(key)) {
          inverted[obj[key]] = key;
        }
      }
      return inverted;
    };

    return {
      eq: eq,
      eq2: eq2,
      peq2: peq2,
      ok: ok,
      fail: fail,
      self: self,
      not: not,
      and: and,
      uniqueId: uniqueId,
      rect2bnd: rect2bnd,
      invertObject: invertObject
    };
  })();

  /**
   * @class core.list
   *
   * list utils
   *
   * @singleton
   * @alternateClassName list
   */
  var list = (function () {
    /**
     * returns the first item of an array.
     *
     * @param {Array} array
     */
    var head = function (array) {
      return array[0];
    };

    /**
     * returns the last item of an array.
     *
     * @param {Array} array
     */
    var last = function (array) {
      return array[array.length - 1];
    };

    /**
     * returns everything but the last entry of the array.
     *
     * @param {Array} array
     */
    var initial = function (array) {
      return array.slice(0, array.length - 1);
    };

    /**
     * returns the rest of the items in an array.
     *
     * @param {Array} array
     */
    var tail = function (array) {
      return array.slice(1);
    };

    /**
     * returns item of array
     */
    var find = function (array, pred) {
      for (var idx = 0, len = array.length; idx < len; idx ++) {
        var item = array[idx];
        if (pred(item)) {
          return item;
        }
      }
    };

    /**
     * returns true if all of the values in the array pass the predicate truth test.
     */
    var all = function (array, pred) {
      for (var idx = 0, len = array.length; idx < len; idx ++) {
        if (!pred(array[idx])) {
          return false;
        }
      }
      return true;
    };

    /**
     * returns true if the value is present in the list.
     */
    var contains = function (array, item) {
      return $.inArray(item, array) !== -1;
    };

    /**
     * get sum from a list
     *
     * @param {Array} array - array
     * @param {Function} fn - iterator
     */
    var sum = function (array, fn) {
      fn = fn || func.self;
      return array.reduce(function (memo, v) {
        return memo + fn(v);
      }, 0);
    };
  
    /**
     * returns a copy of the collection with array type.
     * @param {Collection} collection - collection eg) node.childNodes, ...
     */
    var from = function (collection) {
      var result = [], idx = -1, length = collection.length;
      while (++idx < length) {
        result[idx] = collection[idx];
      }
      return result;
    };
  
    /**
     * cluster elements by predicate function.
     *
     * @param {Array} array - array
     * @param {Function} fn - predicate function for cluster rule
     * @param {Array[]}
     */
    var clusterBy = function (array, fn) {
      if (!array.length) { return []; }
      var aTail = tail(array);
      return aTail.reduce(function (memo, v) {
        var aLast = last(memo);
        if (fn(last(aLast), v)) {
          aLast[aLast.length] = v;
        } else {
          memo[memo.length] = [v];
        }
        return memo;
      }, [[head(array)]]);
    };
  
    /**
     * returns a copy of the array with all falsy values removed
     *
     * @param {Array} array - array
     * @param {Function} fn - predicate function for cluster rule
     */
    var compact = function (array) {
      var aResult = [];
      for (var idx = 0, len = array.length; idx < len; idx ++) {
        if (array[idx]) { aResult.push(array[idx]); }
      }
      return aResult;
    };

    /**
     * produces a duplicate-free version of the array
     *
     * @param {Array} array
     */
    var unique = function (array) {
      var results = [];

      for (var idx = 0, len = array.length; idx < len; idx ++) {
        if (!contains(results, array[idx])) {
          results.push(array[idx]);
        }
      }

      return results;
    };

    /**
     * returns next item.
     * @param {Array} array
     */
    var next = function (array, item) {
      var idx = array.indexOf(item);
      if (idx === -1) { return null; }

      return array[idx + 1];
    };

    /**
     * returns prev item.
     * @param {Array} array
     */
    var prev = function (array, item) {
      var idx = array.indexOf(item);
      if (idx === -1) { return null; }

      return array[idx - 1];
    };

  
    return { head: head, last: last, initial: initial, tail: tail,
             prev: prev, next: next, find: find, contains: contains,
             all: all, sum: sum, from: from,
             clusterBy: clusterBy, compact: compact, unique: unique };
  })();


  var NBSP_CHAR = String.fromCharCode(160);
  var ZERO_WIDTH_NBSP_CHAR = '\ufeff';

  /**
   * @class core.dom
   *
   * Dom functions
   *
   * @singleton
   * @alternateClassName dom
   */
  var dom = (function () {
    /**
     * @method isEditable
     *
     * returns whether node is `note-editable` or not.
     *
     * @param {Node} node
     * @return {Boolean}
     */
    var isEditable = function (node) {
      return node && $(node).hasClass('note-editable');
    };

    /**
     * @method isControlSizing
     *
     * returns whether node is `note-control-sizing` or not.
     *
     * @param {Node} node
     * @return {Boolean}
     */
    var isControlSizing = function (node) {
      return node && $(node).hasClass('note-control-sizing');
    };

    /**
     * @method  buildLayoutInfo
     *
     * build layoutInfo from $editor(.note-editor)
     *
     * @param {jQuery} $editor
     * @return {Object}
     * @return {Function} return.editor
     * @return {Node} return.dropzone
     * @return {Node} return.toolbar
     * @return {Node} return.editable
     * @return {Node} return.codable
     * @return {Node} return.popover
     * @return {Node} return.handle
     * @return {Node} return.dialog
     */
    var buildLayoutInfo = function ($editor) {
      var makeFinder;

      // air mode
      if ($editor.hasClass('note-air-editor')) {
        var id = list.last($editor.attr('id').split('-'));
        makeFinder = function (sIdPrefix) {
          return function () { return $(sIdPrefix + id); };
        };

        return {
          editor: function () { return $editor; },
          editable: function () { return $editor; },
          popover: makeFinder('#note-popover-'),
          handle: makeFinder('#note-handle-'),
          dialog: makeFinder('#note-dialog-')
        };

        // frame mode
      } else {
        makeFinder = function (sClassName) {
          return function () { return $editor.find(sClassName); };
        };
        return {
          editor: function () { return $editor; },
          dropzone: makeFinder('.note-dropzone'),
          toolbar: makeFinder('.note-toolbar'),
          editable: makeFinder('.note-editable'),
          codable: makeFinder('.note-codable'),
          statusbar: makeFinder('.note-statusbar'),
          popover: makeFinder('.note-popover'),
          handle: makeFinder('.note-handle'),
          dialog: makeFinder('.note-dialog')
        };
      }
    };

    /**
     * @method makePredByNodeName
     *
     * returns predicate which judge whether nodeName is same
     *
     * @param {String} nodeName
     * @return {Function}
     */
    var makePredByNodeName = function (nodeName) {
      nodeName = nodeName.toUpperCase();
      return function (node) {
        return node && node.nodeName.toUpperCase() === nodeName;
      };
    };

    /**
     * @method isText
     *
     *
     *
     * @param {Node} node
     * @return {Boolean} true if node's type is text(3)
     */
    var isText = function (node) {
      return node && node.nodeType === 3;
    };

    /**
     * ex) br, col, embed, hr, img, input, ...
     * @see http://www.w3.org/html/wg/drafts/html/master/syntax.html#void-elements
     */
    var isVoid = function (node) {
      return node && /^BR|^IMG|^HR/.test(node.nodeName.toUpperCase());
    };

    var isPara = function (node) {
      if (isEditable(node)) {
        return false;
      }

      // Chrome(v31.0), FF(v25.0.1) use DIV for paragraph
      return node && /^DIV|^P|^LI|^H[1-7]/.test(node.nodeName.toUpperCase());
    };

    var isLi = makePredByNodeName('LI');

    var isPurePara = function (node) {
      return isPara(node) && !isLi(node);
    };

    var isTable = makePredByNodeName('TABLE');

    var isInline = function (node) {
      return !isBodyContainer(node) &&
             !isList(node) &&
             !isPara(node) &&
             !isTable(node) &&
             !isBlockquote(node);
    };

    var isList = function (node) {
      return node && /^UL|^OL/.test(node.nodeName.toUpperCase());
    };

    var isCell = function (node) {
      return node && /^TD|^TH/.test(node.nodeName.toUpperCase());
    };

    var isBlockquote = makePredByNodeName('BLOCKQUOTE');

    var isBodyContainer = function (node) {
      return isCell(node) || isBlockquote(node) || isEditable(node);
    };

    var isAnchor = makePredByNodeName('A');

    var isParaInline = function (node) {
      return isInline(node) && !!ancestor(node, isPara);
    };

    var isBodyInline = function (node) {
      return isInline(node) && !ancestor(node, isPara);
    };

    var isBody = makePredByNodeName('BODY');

    /**
     * returns whether nodeB is closest sibling of nodeA
     *
     * @param {Node} nodeA
     * @param {Node} nodeB
     * @return {Boolean}
     */
    var isClosestSibling = function (nodeA, nodeB) {
      return nodeA.nextSibling === nodeB ||
             nodeA.previousSibling === nodeB;
    };

    /**
     * returns array of closest siblings with node
     *
     * @param {Node} node
     * @param {function} [pred] - predicate function
     * @return {Node[]}
     */
    var withClosestSiblings = function (node, pred) {
      pred = pred || func.ok;

      var siblings = [];
      if (node.previousSibling && pred(node.previousSibling)) {
        siblings.push(node.previousSibling);
      }
      siblings.push(node);
      if (node.nextSibling && pred(node.nextSibling)) {
        siblings.push(node.nextSibling);
      }
      return siblings;
    };

    /**
     * blank HTML for cursor position
     */
    var blankHTML = agent.isMSIE ? '&nbsp;' : '<br>';

    /**
     * @method nodeLength
     *
     * returns #text's text size or element's childNodes size
     *
     * @param {Node} node
     */
    var nodeLength = function (node) {
      if (isText(node)) {
        return node.nodeValue.length;
      }

      return node.childNodes.length;
    };

    /**
     * returns whether node is empty or not.
     *
     * @param {Node} node
     * @return {Boolean}
     */
    var isEmpty = function (node) {
      var len = nodeLength(node);

      if (len === 0) {
        return true;
      } else if (!dom.isText(node) && len === 1 && node.innerHTML === blankHTML) {
        // ex) <p><br></p>, <span><br></span>
        return true;
      }

      return false;
    };

    /**
     * padding blankHTML if node is empty (for cursor position)
     */
    var paddingBlankHTML = function (node) {
      if (!isVoid(node) && !nodeLength(node)) {
        node.innerHTML = blankHTML;
      }
    };

    /**
     * find nearest ancestor predicate hit
     *
     * @param {Node} node
     * @param {Function} pred - predicate function
     */
    var ancestor = function (node, pred) {
      while (node) {
        if (pred(node)) { return node; }
        if (isEditable(node)) { break; }

        node = node.parentNode;
      }
      return null;
    };

    /**
     * find nearest ancestor only single child blood line and predicate hit
     *
     * @param {Node} node
     * @param {Function} pred - predicate function
     */
    var singleChildAncestor = function (node, pred) {
      node = node.parentNode;

      while (node) {
        if (nodeLength(node) !== 1) { break; }
        if (pred(node)) { return node; }
        if (isEditable(node)) { break; }

        node = node.parentNode;
      }
      return null;
    };

    /**
     * returns new array of ancestor nodes (until predicate hit).
     *
     * @param {Node} node
     * @param {Function} [optional] pred - predicate function
     */
    var listAncestor = function (node, pred) {
      pred = pred || func.fail;

      var ancestors = [];
      ancestor(node, function (el) {
        if (!isEditable(el)) {
          ancestors.push(el);
        }

        return pred(el);
      });
      return ancestors;
    };

    /**
     * find farthest ancestor predicate hit
     */
    var lastAncestor = function (node, pred) {
      var ancestors = listAncestor(node);
      return list.last(ancestors.filter(pred));
    };

    /**
     * returns common ancestor node between two nodes.
     *
     * @param {Node} nodeA
     * @param {Node} nodeB
     */
    var commonAncestor = function (nodeA, nodeB) {
      var ancestors = listAncestor(nodeA);
      for (var n = nodeB; n; n = n.parentNode) {
        if ($.inArray(n, ancestors) > -1) { return n; }
      }
      return null; // difference document area
    };

    /**
     * listing all previous siblings (until predicate hit).
     *
     * @param {Node} node
     * @param {Function} [optional] pred - predicate function
     */
    var listPrev = function (node, pred) {
      pred = pred || func.fail;

      var nodes = [];
      while (node) {
        if (pred(node)) { break; }
        nodes.push(node);
        node = node.previousSibling;
      }
      return nodes;
    };

    /**
     * listing next siblings (until predicate hit).
     *
     * @param {Node} node
     * @param {Function} [pred] - predicate function
     */
    var listNext = function (node, pred) {
      pred = pred || func.fail;

      var nodes = [];
      while (node) {
        if (pred(node)) { break; }
        nodes.push(node);
        node = node.nextSibling;
      }
      return nodes;
    };

    /**
     * listing descendant nodes
     *
     * @param {Node} node
     * @param {Function} [pred] - predicate function
     */
    var listDescendant = function (node, pred) {
      var descendents = [];
      pred = pred || func.ok;

      // start DFS(depth first search) with node
      (function fnWalk(current) {
        if (node !== current && pred(current)) {
          descendents.push(current);
        }
        for (var idx = 0, len = current.childNodes.length; idx < len; idx++) {
          fnWalk(current.childNodes[idx]);
        }
      })(node);

      return descendents;
    };

    /**
     * wrap node with new tag.
     *
     * @param {Node} node
     * @param {Node} tagName of wrapper
     * @return {Node} - wrapper
     */
    var wrap = function (node, wrapperName) {
      var parent = node.parentNode;
      var wrapper = $('<' + wrapperName + '>')[0];

      parent.insertBefore(wrapper, node);
      wrapper.appendChild(node);

      return wrapper;
    };

    /**
     * insert node after preceding
     *
     * @param {Node} node
     * @param {Node} preceding - predicate function
     */
    var insertAfter = function (node, preceding) {
      var next = preceding.nextSibling, parent = preceding.parentNode;
      if (next) {
        parent.insertBefore(node, next);
      } else {
        parent.appendChild(node);
      }
      return node;
    };

    /**
     * append elements.
     *
     * @param {Node} node
     * @param {Collection} aChild
     */
    var appendChildNodes = function (node, aChild) {
      $.each(aChild, function (idx, child) {
        node.appendChild(child);
      });
      return node;
    };

    /**
     * returns whether boundaryPoint is left edge or not.
     *
     * @param {BoundaryPoint} point
     * @return {Boolean}
     */
    var isLeftEdgePoint = function (point) {
      return point.offset === 0;
    };

    /**
     * returns whether boundaryPoint is right edge or not.
     *
     * @param {BoundaryPoint} point
     * @return {Boolean}
     */
    var isRightEdgePoint = function (point) {
      return point.offset === nodeLength(point.node);
    };

    /**
     * returns whether boundaryPoint is edge or not.
     *
     * @param {BoundaryPoint} point
     * @return {Boolean}
     */
    var isEdgePoint = function (point) {
      return isLeftEdgePoint(point) || isRightEdgePoint(point);
    };

    /**
     * returns wheter node is left edge of ancestor or not.
     *
     * @param {Node} node
     * @param {Node} ancestor
     * @return {Boolean}
     */
    var isLeftEdgeOf = function (node, ancestor) {
      while (node && node !== ancestor) {
        if (position(node) !== 0) {
          return false;
        }
        node = node.parentNode;
      }

      return true;
    };

    /**
     * returns whether node is right edge of ancestor or not.
     *
     * @param {Node} node
     * @param {Node} ancestor
     * @return {Boolean}
     */
    var isRightEdgeOf = function (node, ancestor) {
      while (node && node !== ancestor) {
        if (position(node) !== nodeLength(node.parentNode) - 1) {
          return false;
        }
        node = node.parentNode;
      }

      return true;
    };

    /**
     * returns offset from parent.
     *
     * @param {Node} node
     */
    var position = function (node) {
      var offset = 0;
      while ((node = node.previousSibling)) {
        offset += 1;
      }
      return offset;
    };

    var hasChildren = function (node) {
      return !!(node && node.childNodes && node.childNodes.length);
    };

    /**
     * returns previous boundaryPoint
     *
     * @param {BoundaryPoint} point
     * @param {Boolean} isSkipInnerOffset
     * @return {BoundaryPoint}
     */
    var prevPoint = function (point, isSkipInnerOffset) {
      var node, offset;

      if (point.offset === 0) {
        if (isEditable(point.node)) {
          return null;
        }

        node = point.node.parentNode;
        offset = position(point.node);
      } else if (hasChildren(point.node)) {
        node = point.node.childNodes[point.offset - 1];
        offset = nodeLength(node);
      } else {
        node = point.node;
        offset = isSkipInnerOffset ? 0 : point.offset - 1;
      }

      return {
        node: node,
        offset: offset
      };
    };

    /**
     * returns next boundaryPoint
     *
     * @param {BoundaryPoint} point
     * @param {Boolean} isSkipInnerOffset
     * @return {BoundaryPoint}
     */
    var nextPoint = function (point, isSkipInnerOffset) {
      var node, offset;

      if (nodeLength(point.node) === point.offset) {
        if (isEditable(point.node)) {
          return null;
        }

        node = point.node.parentNode;
        offset = position(point.node) + 1;
      } else if (hasChildren(point.node)) {
        node = point.node.childNodes[point.offset];
        offset = 0;
      } else {
        node = point.node;
        offset = isSkipInnerOffset ? nodeLength(point.node) : point.offset + 1;
      }

      return {
        node: node,
        offset: offset
      };
    };

    /**
     * returns whether pointA and pointB is same or not.
     *
     * @param {BoundaryPoint} pointA
     * @param {BoundaryPoint} pointB
     * @return {Boolean}
     */
    var isSamePoint = function (pointA, pointB) {
      return pointA.node === pointB.node && pointA.offset === pointB.offset;
    };

    /**
     * returns whether point is visible (can set cursor) or not.
     * 
     * @param {BoundaryPoint} point
     * @return {Boolean}
     */
    var isVisiblePoint = function (point) {
      if (isText(point.node) || !hasChildren(point.node) || isEmpty(point.node)) {
        return true;
      }

      var leftNode = point.node.childNodes[point.offset - 1];
      var rightNode = point.node.childNodes[point.offset];
      if ((!leftNode || isVoid(leftNode)) && (!rightNode || isVoid(rightNode))) {
        return true;
      }

      return false;
    };

    /**
     * @method prevPointUtil
     *
     * @param {BoundaryPoint} point
     * @param {Function} pred
     * @return {BoundaryPoint}
     */
    var prevPointUntil = function (point, pred) {
      while (point) {
        if (pred(point)) {
          return point;
        }

        point = prevPoint(point);
      }

      return null;
    };

    /**
     * @method nextPointUntil
     *
     * @param {BoundaryPoint} point
     * @param {Function} pred
     * @return {BoundaryPoint}
     */
    var nextPointUntil = function (point, pred) {
      while (point) {
        if (pred(point)) {
          return point;
        }

        point = nextPoint(point);
      }

      return null;
    };

    /**
     * @method walkPoint
     *
     * @param {BoundaryPoint} startPoint
     * @param {BoundaryPoint} endPoint
     * @param {Function} handler
     * @param {Boolean} isSkipInnerOffset
     */
    var walkPoint = function (startPoint, endPoint, handler, isSkipInnerOffset) {
      var point = startPoint;

      while (point) {
        handler(point);

        if (isSamePoint(point, endPoint)) {
          break;
        }

        var isSkipOffset = isSkipInnerOffset &&
                           startPoint.node !== point.node &&
                           endPoint.node !== point.node;
        point = nextPoint(point, isSkipOffset);
      }
    };

    /**
     * @method makeOffsetPath
     *
     * return offsetPath(array of offset) from ancestor
     *
     * @param {Node} ancestor - ancestor node
     * @param {Node} node
     */
    var makeOffsetPath = function (ancestor, node) {
      var ancestors = listAncestor(node, func.eq(ancestor));
      return $.map(ancestors, position).reverse();
    };

    /**
     * @method fromOffsetPath
     *
     * return element from offsetPath(array of offset)
     *
     * @param {Node} ancestor - ancestor node
     * @param {array} offsets - offsetPath
     */
    var fromOffsetPath = function (ancestor, offsets) {
      var current = ancestor;
      for (var i = 0, len = offsets.length; i < len; i++) {
        if (current.childNodes.length <= offsets[i]) {
          current = current.childNodes[current.childNodes.length - 1];
        } else {
          current = current.childNodes[offsets[i]];
        }
      }
      return current;
    };

    /**
     * @method splitNode
     *
     * split element or #text
     *
     * @param {BoundaryPoint} point
     * @param {Boolean} [isSkipPaddingBlankHTML]
     * @return {Node} right node of boundaryPoint
     */
    var splitNode = function (point, isSkipPaddingBlankHTML) {
      // split #text
      if (isText(point.node)) {
        // edge case
        if (isLeftEdgePoint(point)) {
          return point.node;
        } else if (isRightEdgePoint(point)) {
          return point.node.nextSibling;
        }

        return point.node.splitText(point.offset);
      }

      // split element
      var childNode = point.node.childNodes[point.offset];
      var clone = insertAfter(point.node.cloneNode(false), point.node);
      appendChildNodes(clone, listNext(childNode));

      if (!isSkipPaddingBlankHTML) {
        paddingBlankHTML(point.node);
        paddingBlankHTML(clone);
      }

      return clone;
    };

    /**
     * @method splitTree
     *
     * split tree by point
     *
     * @param {Node} root - split root
     * @param {BoundaryPoint} point
     * @param {Boolean} [isSkipPaddingBlankHTML]
     * @return {Node} right node of boundaryPoint
     */
    var splitTree = function (root, point, isSkipPaddingBlankHTML) {
      // ex) [#text, <span>, <p>]
      var ancestors = listAncestor(point.node, func.eq(root));

      if (!ancestors.length) {
        return null;
      } else if (ancestors.length === 1) {
        return splitNode(point, isSkipPaddingBlankHTML);
      }

      return ancestors.reduce(function (node, parent) {
        var clone = insertAfter(parent.cloneNode(false), parent);

        if (node === point.node) {
          node = splitNode(point, isSkipPaddingBlankHTML);
        }

        appendChildNodes(clone, listNext(node));

        if (!isSkipPaddingBlankHTML) {
          paddingBlankHTML(parent);
          paddingBlankHTML(clone);
        }
        return clone;
      });
    };

    /**
     * split point
     *
     * @param {Point} point
     * @param {Boolean} isInline
     * @return {Object}
     */
    var splitPoint = function (point, isInline) {
      // find splitRoot, container
      //  - inline: splitRoot is a child of paragraph
      //  - block: splitRoot is a child of bodyContainer
      var pred = isInline ? isPara : isBodyContainer;
      var ancestors = listAncestor(point.node, pred);
      var topAncestor = list.last(ancestors) || point.node;

      var splitRoot, container;
      if (pred(topAncestor)) {
        splitRoot = ancestors[ancestors.length - 2];
        container = topAncestor;
      } else {
        splitRoot = topAncestor;
        container = splitRoot.parentNode;
      }

      // split with splitTree
      var pivot = splitRoot && splitTree(splitRoot, point, isInline);

      return {
        rightNode: pivot,
        container: container
      };
    };

    var create = function (nodeName) {
      return document.createElement(nodeName);
    };

    var createText = function (text) {
      return document.createTextNode(text);
    };

    /**
     * @method remove
     *
     * remove node, (isRemoveChild: remove child or not)
     *
     * @param {Node} node
     * @param {Boolean} isRemoveChild
     */
    var remove = function (node, isRemoveChild) {
      if (!node || !node.parentNode) { return; }
      if (node.removeNode) { return node.removeNode(isRemoveChild); }

      var parent = node.parentNode;
      if (!isRemoveChild) {
        var nodes = [];
        var i, len;
        for (i = 0, len = node.childNodes.length; i < len; i++) {
          nodes.push(node.childNodes[i]);
        }

        for (i = 0, len = nodes.length; i < len; i++) {
          parent.insertBefore(nodes[i], node);
        }
      }

      parent.removeChild(node);
    };

    /**
     * @method removeWhile
     *
     * @param {Node} node
     * @param {Function} pred
     */
    var removeWhile = function (node, pred) {
      while (node) {
        if (isEditable(node) || !pred(node)) {
          break;
        }

        var parent = node.parentNode;
        remove(node);
        node = parent;
      }
    };

    /**
     * @method replace
     *
     * replace node with provided nodeName
     *
     * @param {Node} node
     * @param {String} nodeName
     * @return {Node} - new node
     */
    var replace = function (node, nodeName) {
      if (node.nodeName.toUpperCase() === nodeName.toUpperCase()) {
        return node;
      }

      var newNode = create(nodeName);

      if (node.style.cssText) {
        newNode.style.cssText = node.style.cssText;
      }

      appendChildNodes(newNode, list.from(node.childNodes));
      insertAfter(newNode, node);
      remove(node);

      return newNode;
    };

    var isTextarea = makePredByNodeName('TEXTAREA');

    /**
     * @method html
     *
     * get the HTML contents of node
     *
     * @param {jQuery} $node
     * @param {Boolean} [isNewlineOnBlock]
     */
    var html = function ($node, isNewlineOnBlock) {
      var markup = isTextarea($node[0]) ? $node.val() : $node.html();

      if (isNewlineOnBlock) {
        var regexTag = /<(\/?)(\b(?!!)[^>\s]*)(.*?)(\s*\/?>)/g;
        markup = markup.replace(regexTag, function (match, endSlash, name) {
          name = name.toUpperCase();
          var isEndOfInlineContainer = /^DIV|^TD|^TH|^P|^LI|^H[1-7]/.test(name) &&
                                       !!endSlash;
          var isBlockNode = /^BLOCKQUOTE|^TABLE|^TBODY|^TR|^HR|^UL|^OL/.test(name);

          return match + ((isEndOfInlineContainer || isBlockNode) ? '\n' : '');
        });
        markup = $.trim(markup);
      }

      return markup;
    };

    var value = function ($textarea, stripLinebreaks) {
      var val = $textarea.val();
      if (stripLinebreaks) {
        return val.replace(/[\n\r]/g, '');
      }
      return val;
    };

    return {
      /** @property {String} NBSP_CHAR */
      NBSP_CHAR: NBSP_CHAR,
      /** @property {String} ZERO_WIDTH_NBSP_CHAR */
      ZERO_WIDTH_NBSP_CHAR: ZERO_WIDTH_NBSP_CHAR,
      /** @property {String} blank */
      blank: blankHTML,
      /** @property {String} emptyPara */
      emptyPara: '<p>' + blankHTML + '</p>',
      makePredByNodeName: makePredByNodeName,
      isEditable: isEditable,
      isControlSizing: isControlSizing,
      buildLayoutInfo: buildLayoutInfo,
      isText: isText,
      isVoid: isVoid,
      isPara: isPara,
      isPurePara: isPurePara,
      isInline: isInline,
      isBodyInline: isBodyInline,
      isBody: isBody,
      isParaInline: isParaInline,
      isList: isList,
      isTable: isTable,
      isCell: isCell,
      isBlockquote: isBlockquote,
      isBodyContainer: isBodyContainer,
      isAnchor: isAnchor,
      isDiv: makePredByNodeName('DIV'),
      isLi: isLi,
      isBR: makePredByNodeName('BR'),
      isSpan: makePredByNodeName('SPAN'),
      isB: makePredByNodeName('B'),
      isU: makePredByNodeName('U'),
      isS: makePredByNodeName('S'),
      isI: makePredByNodeName('I'),
      isImg: makePredByNodeName('IMG'),
      isTextarea: isTextarea,
      isEmpty: isEmpty,
      isEmptyAnchor: func.and(isAnchor, isEmpty),
      isClosestSibling: isClosestSibling,
      withClosestSiblings: withClosestSiblings,
      nodeLength: nodeLength,
      isLeftEdgePoint: isLeftEdgePoint,
      isRightEdgePoint: isRightEdgePoint,
      isEdgePoint: isEdgePoint,
      isLeftEdgeOf: isLeftEdgeOf,
      isRightEdgeOf: isRightEdgeOf,
      prevPoint: prevPoint,
      nextPoint: nextPoint,
      isSamePoint: isSamePoint,
      isVisiblePoint: isVisiblePoint,
      prevPointUntil: prevPointUntil,
      nextPointUntil: nextPointUntil,
      walkPoint: walkPoint,
      ancestor: ancestor,
      singleChildAncestor: singleChildAncestor,
      listAncestor: listAncestor,
      lastAncestor: lastAncestor,
      listNext: listNext,
      listPrev: listPrev,
      listDescendant: listDescendant,
      commonAncestor: commonAncestor,
      wrap: wrap,
      insertAfter: insertAfter,
      appendChildNodes: appendChildNodes,
      position: position,
      hasChildren: hasChildren,
      makeOffsetPath: makeOffsetPath,
      fromOffsetPath: fromOffsetPath,
      splitTree: splitTree,
      splitPoint: splitPoint,
      create: create,
      createText: createText,
      remove: remove,
      removeWhile: removeWhile,
      replace: replace,
      html: html,
      value: value
    };
  })();


  var range = (function () {

    /**
     * return boundaryPoint from TextRange, inspired by Andy Na's HuskyRange.js
     *
     * @param {TextRange} textRange
     * @param {Boolean} isStart
     * @return {BoundaryPoint}
     *
     * @see http://msdn.microsoft.com/en-us/library/ie/ms535872(v=vs.85).aspx
     */
    var textRangeToPoint = function (textRange, isStart) {
      var container = textRange.parentElement(), offset;
  
      var tester = document.body.createTextRange(), prevContainer;
      var childNodes = list.from(container.childNodes);
      for (offset = 0; offset < childNodes.length; offset++) {
        if (dom.isText(childNodes[offset])) {
          continue;
        }
        tester.moveToElementText(childNodes[offset]);
        if (tester.compareEndPoints('StartToStart', textRange) >= 0) {
          break;
        }
        prevContainer = childNodes[offset];
      }
  
      if (offset !== 0 && dom.isText(childNodes[offset - 1])) {
        var textRangeStart = document.body.createTextRange(), curTextNode = null;
        textRangeStart.moveToElementText(prevContainer || container);
        textRangeStart.collapse(!prevContainer);
        curTextNode = prevContainer ? prevContainer.nextSibling : container.firstChild;
  
        var pointTester = textRange.duplicate();
        pointTester.setEndPoint('StartToStart', textRangeStart);
        var textCount = pointTester.text.replace(/[\r\n]/g, '').length;
  
        while (textCount > curTextNode.nodeValue.length && curTextNode.nextSibling) {
          textCount -= curTextNode.nodeValue.length;
          curTextNode = curTextNode.nextSibling;
        }
  
        /* jshint ignore:start */
        var dummy = curTextNode.nodeValue; // enforce IE to re-reference curTextNode, hack
        /* jshint ignore:end */
  
        if (isStart && curTextNode.nextSibling && dom.isText(curTextNode.nextSibling) &&
            textCount === curTextNode.nodeValue.length) {
          textCount -= curTextNode.nodeValue.length;
          curTextNode = curTextNode.nextSibling;
        }
  
        container = curTextNode;
        offset = textCount;
      }
  
      return {
        cont: container,
        offset: offset
      };
    };
    
    /**
     * return TextRange from boundary point (inspired by google closure-library)
     * @param {BoundaryPoint} point
     * @return {TextRange}
     */
    var pointToTextRange = function (point) {
      var textRangeInfo = function (container, offset) {
        var node, isCollapseToStart;
  
        if (dom.isText(container)) {
          var prevTextNodes = dom.listPrev(container, func.not(dom.isText));
          var prevContainer = list.last(prevTextNodes).previousSibling;
          node =  prevContainer || container.parentNode;
          offset += list.sum(list.tail(prevTextNodes), dom.nodeLength);
          isCollapseToStart = !prevContainer;
        } else {
          node = container.childNodes[offset] || container;
          if (dom.isText(node)) {
            return textRangeInfo(node, 0);
          }
  
          offset = 0;
          isCollapseToStart = false;
        }
  
        return {
          node: node,
          collapseToStart: isCollapseToStart,
          offset: offset
        };
      };
  
      var textRange = document.body.createTextRange();
      var info = textRangeInfo(point.node, point.offset);
  
      textRange.moveToElementText(info.node);
      textRange.collapse(info.collapseToStart);
      textRange.moveStart('character', info.offset);
      return textRange;
    };
    
    /**
     * Wrapped Range
     *
     * @constructor
     * @param {Node} sc - start container
     * @param {Number} so - start offset
     * @param {Node} ec - end container
     * @param {Number} eo - end offset
     */
    var WrappedRange = function (sc, so, ec, eo) {
      this.sc = sc;
      this.so = so;
      this.ec = ec;
      this.eo = eo;
  
      // nativeRange: get nativeRange from sc, so, ec, eo
      var nativeRange = function () {
        if (agent.isW3CRangeSupport) {
          var w3cRange = document.createRange();
          w3cRange.setStart(sc, so);
          w3cRange.setEnd(ec, eo);

          return w3cRange;
        } else {
          var textRange = pointToTextRange({
            node: sc,
            offset: so
          });

          textRange.setEndPoint('EndToEnd', pointToTextRange({
            node: ec,
            offset: eo
          }));

          return textRange;
        }
      };

      this.getPoints = function () {
        return {
          sc: sc,
          so: so,
          ec: ec,
          eo: eo
        };
      };

      this.getStartPoint = function () {
        return {
          node: sc,
          offset: so
        };
      };

      this.getEndPoint = function () {
        return {
          node: ec,
          offset: eo
        };
      };

      /**
       * select update visible range
       */
      this.select = function () {
        var nativeRng = nativeRange();
        if (agent.isW3CRangeSupport) {
          var selection = document.getSelection();
          if (selection.rangeCount > 0) {
            selection.removeAllRanges();
          }
          selection.addRange(nativeRng);
        } else {
          nativeRng.select();
        }
      };

      /**
       * @return {WrappedRange}
       */
      this.normalize = function () {

        /**
         * @param {BoundaryPoint} point
         * @return {BoundaryPoint}
         */
        var getVisiblePoint = function (point) {
          if (!dom.isVisiblePoint(point)) {
            if (dom.isLeftEdgePoint(point)) {
              point = dom.nextPointUntil(point, dom.isVisiblePoint);
            } else {
              point = dom.prevPointUntil(point, dom.isVisiblePoint);
            }
          }
          return point;
        };

        var startPoint = getVisiblePoint(this.getStartPoint());
        var endPoint = getVisiblePoint(this.getEndPoint());

        return new WrappedRange(
          startPoint.node,
          startPoint.offset,
          endPoint.node,
          endPoint.offset
        );
      };

      /**
       * returns matched nodes on range
       *
       * @param {Function} [pred] - predicate function
       * @param {Object} [options]
       * @param {Boolean} [options.includeAncestor]
       * @param {Boolean} [options.fullyContains]
       * @return {Node[]}
       */
      this.nodes = function (pred, options) {
        pred = pred || func.ok;

        var includeAncestor = options && options.includeAncestor;
        var fullyContains = options && options.fullyContains;

        // TODO compare points and sort
        var startPoint = this.getStartPoint();
        var endPoint = this.getEndPoint();

        var nodes = [];
        var leftEdgeNodes = [];

        dom.walkPoint(startPoint, endPoint, function (point) {
          if (dom.isEditable(point.node)) {
            return;
          }

          var node;
          if (fullyContains) {
            if (dom.isLeftEdgePoint(point)) {
              leftEdgeNodes.push(point.node);
            }
            if (dom.isRightEdgePoint(point) && list.contains(leftEdgeNodes, point.node)) {
              node = point.node;
            }
          } else if (includeAncestor) {
            node = dom.ancestor(point.node, pred);
          } else {
            node = point.node;
          }

          if (node && pred(node)) {
            nodes.push(node);
          }
        }, true);

        return list.unique(nodes);
      };

      /**
       * returns commonAncestor of range
       * @return {Element} - commonAncestor
       */
      this.commonAncestor = function () {
        return dom.commonAncestor(sc, ec);
      };

      /**
       * returns expanded range by pred
       *
       * @param {Function} pred - predicate function
       * @return {WrappedRange}
       */
      this.expand = function (pred) {
        var startAncestor = dom.ancestor(sc, pred);
        var endAncestor = dom.ancestor(ec, pred);

        if (!startAncestor && !endAncestor) {
          return new WrappedRange(sc, so, ec, eo);
        }

        var boundaryPoints = this.getPoints();

        if (startAncestor) {
          boundaryPoints.sc = startAncestor;
          boundaryPoints.so = 0;
        }

        if (endAncestor) {
          boundaryPoints.ec = endAncestor;
          boundaryPoints.eo = dom.nodeLength(endAncestor);
        }

        return new WrappedRange(
          boundaryPoints.sc,
          boundaryPoints.so,
          boundaryPoints.ec,
          boundaryPoints.eo
        );
      };

      /**
       * @param {Boolean} isCollapseToStart
       * @return {WrappedRange}
       */
      this.collapse = function (isCollapseToStart) {
        if (isCollapseToStart) {
          return new WrappedRange(sc, so, sc, so);
        } else {
          return new WrappedRange(ec, eo, ec, eo);
        }
      };

      /**
       * splitText on range
       */
      this.splitText = function () {
        var isSameContainer = sc === ec;
        var boundaryPoints = this.getPoints();

        if (dom.isText(ec) && !dom.isEdgePoint(this.getEndPoint())) {
          ec.splitText(eo);
        }

        if (dom.isText(sc) && !dom.isEdgePoint(this.getStartPoint())) {
          boundaryPoints.sc = sc.splitText(so);
          boundaryPoints.so = 0;

          if (isSameContainer) {
            boundaryPoints.ec = boundaryPoints.sc;
            boundaryPoints.eo = eo - so;
          }
        }

        return new WrappedRange(
          boundaryPoints.sc,
          boundaryPoints.so,
          boundaryPoints.ec,
          boundaryPoints.eo
        );
      };

      /**
       * delete contents on range
       * @return {WrappedRange}
       */
      this.deleteContents = function () {
        if (this.isCollapsed()) {
          return this;
        }

        var rng = this.splitText();
        var nodes = rng.nodes(null, {
          fullyContains: true
        });

        // find new cursor point
        var point = dom.prevPointUntil(rng.getStartPoint(), function (point) {
          return !list.contains(nodes, point.node);
        });

        var emptyParents = [];
        $.each(nodes, function (idx, node) {
          // find empty parents
          var parent = node.parentNode;
          if (point.node !== parent && dom.nodeLength(parent) === 1) {
            emptyParents.push(parent);
          }
          dom.remove(node, false);
        });

        // remove empty parents
        $.each(emptyParents, function (idx, node) {
          dom.remove(node, false);
        });

        return new WrappedRange(
          point.node,
          point.offset,
          point.node,
          point.offset
        ).normalize();
      };
      
      /**
       * makeIsOn: return isOn(pred) function
       */
      var makeIsOn = function (pred) {
        return function () {
          var ancestor = dom.ancestor(sc, pred);
          return !!ancestor && (ancestor === dom.ancestor(ec, pred));
        };
      };
  
      // isOnEditable: judge whether range is on editable or not
      this.isOnEditable = makeIsOn(dom.isEditable);
      // isOnList: judge whether range is on list node or not
      this.isOnList = makeIsOn(dom.isList);
      // isOnAnchor: judge whether range is on anchor node or not
      this.isOnAnchor = makeIsOn(dom.isAnchor);
      // isOnAnchor: judge whether range is on cell node or not
      this.isOnCell = makeIsOn(dom.isCell);

      /**
       * @param {Function} pred
       * @return {Boolean}
       */
      this.isLeftEdgeOf = function (pred) {
        if (!dom.isLeftEdgePoint(this.getStartPoint())) {
          return false;
        }

        var node = dom.ancestor(this.sc, pred);
        return node && dom.isLeftEdgeOf(this.sc, node);
      };

      /**
       * returns whether range was collapsed or not
       */
      this.isCollapsed = function () {
        return sc === ec && so === eo;
      };

      /**
       * wrap inline nodes which children of body with paragraph
       *
       * @return {WrappedRange}
       */
      this.wrapBodyInlineWithPara = function () {
        if (dom.isBodyContainer(sc) && dom.isEmpty(sc)) {
          sc.innerHTML = dom.emptyPara;
          return new WrappedRange(sc.firstChild, 0, sc.firstChild, 0);
        }

        if (dom.isParaInline(sc) || dom.isPara(sc)) {
          return this.normalize();
        }

        // find inline top ancestor
        var topAncestor;
        if (dom.isInline(sc)) {
          var ancestors = dom.listAncestor(sc, func.not(dom.isInline));
          topAncestor = list.last(ancestors);
          if (!dom.isInline(topAncestor)) {
            topAncestor = ancestors[ancestors.length - 2] || sc.childNodes[so];
          }
        } else {
          topAncestor = sc.childNodes[so > 0 ? so - 1 : 0];
        }

        // siblings not in paragraph
        var inlineSiblings = dom.listPrev(topAncestor, dom.isParaInline).reverse();
        inlineSiblings = inlineSiblings.concat(dom.listNext(topAncestor.nextSibling, dom.isParaInline));

        // wrap with paragraph
        if (inlineSiblings.length) {
          var para = dom.wrap(list.head(inlineSiblings), 'p');
          dom.appendChildNodes(para, list.tail(inlineSiblings));
        }

        return this.normalize();
      };

      /**
       * insert node at current cursor
       *
       * @param {Node} node
       * @return {Node}
       */
      this.insertNode = function (node) {
        var rng = this.wrapBodyInlineWithPara().deleteContents();
        var info = dom.splitPoint(rng.getStartPoint(), dom.isInline(node));

        if (info.rightNode) {
          info.rightNode.parentNode.insertBefore(node, info.rightNode);
        } else {
          info.container.appendChild(node);
        }

        return node;
      };
  
      /**
       * returns text in range
       *
       * @return {String}
       */
      this.toString = function () {
        var nativeRng = nativeRange();
        return agent.isW3CRangeSupport ? nativeRng.toString() : nativeRng.text;
      };
  
      /**
       * create offsetPath bookmark
       *
       * @param {Node} editable
       */
      this.bookmark = function (editable) {
        return {
          s: {
            path: dom.makeOffsetPath(editable, sc),
            offset: so
          },
          e: {
            path: dom.makeOffsetPath(editable, ec),
            offset: eo
          }
        };
      };

      /**
       * create offsetPath bookmark base on paragraph
       *
       * @param {Node[]} paras
       */
      this.paraBookmark = function (paras) {
        return {
          s: {
            path: list.tail(dom.makeOffsetPath(list.head(paras), sc)),
            offset: so
          },
          e: {
            path: list.tail(dom.makeOffsetPath(list.last(paras), ec)),
            offset: eo
          }
        };
      };

      /**
       * getClientRects
       * @return {Rect[]}
       */
      this.getClientRects = function () {
        var nativeRng = nativeRange();
        return nativeRng.getClientRects();
      };
    };

  /**
   * @class core.range
   *
   * Data structure
   *  * BoundaryPoint: a point of dom tree
   *  * BoundaryPoints: two boundaryPoints corresponding to the start and the end of the Range
   *
   * See to http://www.w3.org/TR/DOM-Level-2-Traversal-Range/ranges.html#Level-2-Range-Position
   *
   * @singleton
   * @alternateClassName range
   */
    return {
      /**
       * @method
       * 
       * create Range Object From arguments or Browser Selection
       *
       * @param {Node} sc - start container
       * @param {Number} so - start offset
       * @param {Node} ec - end container
       * @param {Number} eo - end offset
       * @return {WrappedRange}
       */
      create : function (sc, so, ec, eo) {
        if (!arguments.length) { // from Browser Selection
          if (agent.isW3CRangeSupport) {
            var selection = document.getSelection();
            if (selection.rangeCount === 0) {
              return null;
            } else if (dom.isBody(selection.anchorNode)) {
              // Firefox: returns entire body as range on initialization. We won't never need it.
              return null;
            }
  
            var nativeRng = selection.getRangeAt(0);
            sc = nativeRng.startContainer;
            so = nativeRng.startOffset;
            ec = nativeRng.endContainer;
            eo = nativeRng.endOffset;
          } else { // IE8: TextRange
            var textRange = document.selection.createRange();
            var textRangeEnd = textRange.duplicate();
            textRangeEnd.collapse(false);
            var textRangeStart = textRange;
            textRangeStart.collapse(true);
  
            var startPoint = textRangeToPoint(textRangeStart, true),
            endPoint = textRangeToPoint(textRangeEnd, false);

            // same visible point case: range was collapsed.
            if (dom.isText(startPoint.node) && dom.isLeftEdgePoint(startPoint) &&
                dom.isTextNode(endPoint.node) && dom.isRightEdgePoint(endPoint) &&
                endPoint.node.nextSibling === startPoint.node) {
              startPoint = endPoint;
            }

            sc = startPoint.cont;
            so = startPoint.offset;
            ec = endPoint.cont;
            eo = endPoint.offset;
          }
        } else if (arguments.length === 2) { //collapsed
          ec = sc;
          eo = so;
        }
        return new WrappedRange(sc, so, ec, eo);
      },

      /**
       * @method 
       * 
       * create WrappedRange from node
       *
       * @param {Node} node
       * @return {WrappedRange}
       */
      createFromNode: function (node) {
        var sc = node;
        var so = 0;
        var ec = node;
        var eo = dom.nodeLength(ec);

        // browsers can't target a picture or void node
        if (dom.isVoid(sc)) {
          so = dom.listPrev(sc).length - 1;
          sc = sc.parentNode;
        }
        if (dom.isBR(ec)) {
          eo = dom.listPrev(ec).length - 1;
          ec = ec.parentNode;
        } else if (dom.isVoid(ec)) {
          eo = dom.listPrev(ec).length;
          ec = ec.parentNode;
        }

        return this.create(sc, so, ec, eo);
      },

      /**
       * @method 
       * 
       * create WrappedRange from bookmark
       *
       * @param {Node} editable
       * @param {Object} bookmark
       * @return {WrappedRange}
       */
      createFromBookmark : function (editable, bookmark) {
        var sc = dom.fromOffsetPath(editable, bookmark.s.path);
        var so = bookmark.s.offset;
        var ec = dom.fromOffsetPath(editable, bookmark.e.path);
        var eo = bookmark.e.offset;
        return new WrappedRange(sc, so, ec, eo);
      },

      /**
       * @method 
       *
       * create WrappedRange from paraBookmark
       *
       * @param {Object} bookmark
       * @param {Node[]} paras
       * @return {WrappedRange}
       */
      createFromParaBookmark: function (bookmark, paras) {
        var so = bookmark.s.offset;
        var eo = bookmark.e.offset;
        var sc = dom.fromOffsetPath(list.head(paras), bookmark.s.path);
        var ec = dom.fromOffsetPath(list.last(paras), bookmark.e.path);

        return new WrappedRange(sc, so, ec, eo);
      }
    };
  })();

  /**
   * @class settings 
   * 
   * @singleton
   */
  var settings = {
    /** @property */
    version: '0.6.1',

    /**
     * 
     * for event options, reference to EventHandler.attach
     * 
     * @property {Object} options 
     * @property {String/Number} [options.width=null] set editor width 
     * @property {String/Number} [options.height=null] set editor height, ex) 300
     * @property {String/Number} options.minHeight set minimum height of editor
     * @property {String/Number} options.maxHeight
     * @property {String/Number} options.focus 
     * @property {Number} options.tabsize 
     * @property {Boolean} options.styleWithSpan
     * @property {Object} options.codemirror
     * @property {Object} [options.codemirror.mode='text/html']
     * @property {Object} [options.codemirror.htmlMode=true]
     * @property {Object} [options.codemirror.lineNumbers=true]
     * @property {String} [options.lang=en-US] language 'en-US', 'ko-KR', ...
     * @property {String} [options.direction=null] text direction, ex) 'rtl'
     * @property {Array} [options.toolbar]
     * @property {Boolean} [options.airMode=false]
     * @property {Array} [options.airPopover]
     * @property {Fucntion} [options.onInit] initialize
     * @property {Fucntion} [options.onsubmit]
     */
    options: {
      width: null,                  // set editor width
      height: null,                 // set editor height, ex) 300

      minHeight: null,              // set minimum height of editor
      maxHeight: null,              // set maximum height of editor

      focus: false,                 // set focus to editable area after initializing summernote

      tabsize: 4,                   // size of tab ex) 2 or 4
      styleWithSpan: true,          // style with span (Chrome and FF only)

      disableLinkTarget: false,     // hide link Target Checkbox
      disableDragAndDrop: false,    // disable drag and drop event
      disableResizeEditor: false,   // disable resizing editor

      shortcuts: true,              // enable keyboard shortcuts

      placeholder: false,           // enable placeholder text
      prettifyHtml: true,           // enable prettifying html while toggling codeview

      codemirror: {                 // codemirror options
        mode: 'text/html',
        htmlMode: true,
        lineNumbers: true
      },

      // language
      lang: 'en-US',                // language 'en-US', 'ko-KR', ...
      direction: null,              // text direction, ex) 'rtl'

      // toolbar
      toolbar: [
        ['style', ['style']],
        ['font', ['bold', 'italic', 'underline', 'clear']],
        ['fontname', ['fontname']],
        ['color', ['color']],
        ['para', ['ul', 'ol', 'paragraph']],
        ['height', ['height']],
        ['table', ['table']],
        ['insert', ['link', 'picture', 'hr']],
        ['view', ['fullscreen', 'codeview']],
        ['help', ['help']]
      ],

      // air mode: inline editor
      airMode: false,
      // airPopover: [
      //   ['style', ['style']],
      //   ['font', ['bold', 'italic', 'underline', 'clear']],
      //   ['fontname', ['fontname']],
      //   ['color', ['color']],
      //   ['para', ['ul', 'ol', 'paragraph']],
      //   ['height', ['height']],
      //   ['table', ['table']],
      //   ['insert', ['link', 'picture']],
      //   ['help', ['help']]
      // ],
      airPopover: [
        ['color', ['color']],
        ['font', ['bold', 'underline', 'clear']],
        ['para', ['ul', 'paragraph']],
        ['table', ['table']],
        ['insert', ['link', 'picture']]
      ],

      // style tag
      styleTags: ['p', 'blockquote', 'pre', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6'],

      // default fontName
      defaultFontName: 'Helvetica Neue',

      // fontName
      fontNames: [
        'Arial', 'Arial Black', 'Comic Sans MS', 'Courier New',
        'Helvetica Neue', 'Impact', 'Lucida Grande',
        'Tahoma', 'Times New Roman', 'Verdana'
      ],
      fontNamesIgnoreCheck: [],

      // pallete colors(n x n)
      colors: [
        ['#000000', '#424242', '#636363', '#9C9C94', '#CEC6CE', '#EFEFEF', '#F7F7F7', '#FFFFFF'],
        ['#FF0000', '#FF9C00', '#FFFF00', '#00FF00', '#00FFFF', '#0000FF', '#9C00FF', '#FF00FF'],
        ['#F7C6CE', '#FFE7CE', '#FFEFC6', '#D6EFD6', '#CEDEE7', '#CEE7F7', '#D6D6E7', '#E7D6DE'],
        ['#E79C9C', '#FFC69C', '#FFE79C', '#B5D6A5', '#A5C6CE', '#9CC6EF', '#B5A5D6', '#D6A5BD'],
        ['#E76363', '#F7AD6B', '#FFD663', '#94BD7B', '#73A5AD', '#6BADDE', '#8C7BC6', '#C67BA5'],
        ['#CE0000', '#E79439', '#EFC631', '#6BA54A', '#4A7B8C', '#3984C6', '#634AA5', '#A54A7B'],
        ['#9C0000', '#B56308', '#BD9400', '#397B21', '#104A5A', '#085294', '#311873', '#731842'],
        ['#630000', '#7B3900', '#846300', '#295218', '#083139', '#003163', '#21104A', '#4A1031']
      ],

      // lineHeight
      lineHeights: ['1.0', '1.2', '1.4', '1.5', '1.6', '1.8', '2.0', '3.0'],

      // insertTable max size
      insertTableMaxSize: {
        col: 10,
        row: 10
      },

      // image
      maximumImageFileSize: null, // size in bytes, null = no limit

      // callbacks
      oninit: null,             // initialize
      onfocus: null,            // editable has focus
      onblur: null,             // editable out of focus
      onenter: null,            // enter key pressed
      onkeyup: null,            // keyup
      onkeydown: null,          // keydown
      onImageUpload: null,      // imageUpload
      onImageUploadError: null, // imageUploadError
      onMediaDelete: null,      // media delete
      onToolbarClick: null,
      onsubmit: null,

      /**
       * manipulate link address when user create link
       * @param {String} sLinkUrl
       * @return {String}
       */
      onCreateLink: function (sLinkUrl) {
        if (sLinkUrl.indexOf('@') !== -1 && sLinkUrl.indexOf(':') === -1) {
          sLinkUrl =  'mailto:' + sLinkUrl;
        } else if (sLinkUrl.indexOf('://') === -1) {
          sLinkUrl = 'http://' + sLinkUrl;
        }

        return sLinkUrl;
      },

      keyMap: {
        pc: {
          'ENTER': 'insertParagraph',
          'CTRL+Z': 'undo',
          'CTRL+Y': 'redo',
          'TAB': 'tab',
          'SHIFT+TAB': 'untab',
          'CTRL+B': 'bold',
          'CTRL+I': 'italic',
          'CTRL+U': 'underline',
          'CTRL+SHIFT+S': 'strikethrough',
          'CTRL+BACKSLASH': 'removeFormat',
          'CTRL+SHIFT+L': 'justifyLeft',
          'CTRL+SHIFT+E': 'justifyCenter',
          'CTRL+SHIFT+R': 'justifyRight',
          'CTRL+SHIFT+J': 'justifyFull',
          'CTRL+SHIFT+NUM7': 'insertUnorderedList',
          'CTRL+SHIFT+NUM8': 'insertOrderedList',
          'CTRL+LEFTBRACKET': 'outdent',
          'CTRL+RIGHTBRACKET': 'indent',
          'CTRL+NUM0': 'formatPara',
          'CTRL+NUM1': 'formatH1',
          'CTRL+NUM2': 'formatH2',
          'CTRL+NUM3': 'formatH3',
          'CTRL+NUM4': 'formatH4',
          'CTRL+NUM5': 'formatH5',
          'CTRL+NUM6': 'formatH6',
          'CTRL+ENTER': 'insertHorizontalRule',
          'CTRL+K': 'showLinkDialog'
        },

        mac: {
          'ENTER': 'insertParagraph',
          'CMD+Z': 'undo',
          'CMD+SHIFT+Z': 'redo',
          'TAB': 'tab',
          'SHIFT+TAB': 'untab',
          'CMD+B': 'bold',
          'CMD+I': 'italic',
          'CMD+U': 'underline',
          'CMD+SHIFT+S': 'strikethrough',
          'CMD+BACKSLASH': 'removeFormat',
          'CMD+SHIFT+L': 'justifyLeft',
          'CMD+SHIFT+E': 'justifyCenter',
          'CMD+SHIFT+R': 'justifyRight',
          'CMD+SHIFT+J': 'justifyFull',
          'CMD+SHIFT+NUM7': 'insertUnorderedList',
          'CMD+SHIFT+NUM8': 'insertOrderedList',
          'CMD+LEFTBRACKET': 'outdent',
          'CMD+RIGHTBRACKET': 'indent',
          'CMD+NUM0': 'formatPara',
          'CMD+NUM1': 'formatH1',
          'CMD+NUM2': 'formatH2',
          'CMD+NUM3': 'formatH3',
          'CMD+NUM4': 'formatH4',
          'CMD+NUM5': 'formatH5',
          'CMD+NUM6': 'formatH6',
          'CMD+ENTER': 'insertHorizontalRule',
          'CMD+K': 'showLinkDialog'
        }
      }
    },

    // default language: en-US
    lang: {
      'en-US': {
        font: {
          bold: 'Bold',
          italic: 'Italic',
          underline: 'Underline',
          clear: 'Remove Font Style',
          height: 'Line Height',
          name: 'Font Family'
        },
        image: {
          image: 'Picture',
          insert: 'Insert Image',
          resizeFull: 'Resize Full',
          resizeHalf: 'Resize Half',
          resizeQuarter: 'Resize Quarter',
          floatLeft: 'Float Left',
          floatRight: 'Float Right',
          floatNone: 'Float None',
          shapeRounded: 'Shape: Rounded',
          shapeCircle: 'Shape: Circle',
          shapeThumbnail: 'Shape: Thumbnail',
          shapeNone: 'Shape: None',
          dragImageHere: 'Drag image or text here',
          dropImage: 'Drop image or Text',
          selectFromFiles: 'Select from files',
          maximumFileSize: 'Maximum file size',
          maximumFileSizeError: 'Maximum file size exceeded.',
          url: 'Image URL',
          remove: 'Remove Image'
        },
        link: {
          link: 'Link',
          insert: 'Insert Link',
          unlink: 'Unlink',
          edit: 'Edit',
          textToDisplay: 'Text to display',
          url: 'To what URL should this link go?',
          openInNewWindow: 'Open in new window'
        },
        table: {
          table: 'Table'
        },
        hr: {
          insert: 'Insert Horizontal Rule'
        },
        style: {
          style: 'Style',
          normal: 'Normal',
          blockquote: 'Quote',
          pre: 'Code',
          h1: 'Header 1',
          h2: 'Header 2',
          h3: 'Header 3',
          h4: 'Header 4',
          h5: 'Header 5',
          h6: 'Header 6'
        },
        lists: {
          unordered: 'Unordered list',
          ordered: 'Ordered list'
        },
        options: {
          help: 'Help',
          fullscreen: 'Full Screen',
          codeview: 'Code View'
        },
        paragraph: {
          paragraph: 'Paragraph',
          outdent: 'Outdent',
          indent: 'Indent',
          left: 'Align left',
          center: 'Align center',
          right: 'Align right',
          justify: 'Justify full'
        },
        color: {
          recent: 'Recent Color',
          more: 'More Color',
          background: 'Background Color',
          foreground: 'Foreground Color',
          transparent: 'Transparent',
          setTransparent: 'Set transparent',
          reset: 'Reset',
          resetToDefault: 'Reset to default'
        },
        shortcut: {
          shortcuts: 'Keyboard shortcuts',
          close: 'Close',
          textFormatting: 'Text formatting',
          action: 'Action',
          paragraphFormatting: 'Paragraph formatting',
          documentStyle: 'Document Style',
          extraKeys: 'Extra keys'
        },
        history: {
          undo: 'Undo',
          redo: 'Redo'
        }
      }
    }
  };

  /**
   * @class core.async
   *
   * Async functions which returns `Promise`
   *
   * @singleton
   * @alternateClassName async
   */
  var async = (function () {
    /**
     * @method readFileAsDataURL
     *
     * read contents of file as representing URL
     *
     * @param {File} file
     * @return {Promise} - then: sDataUrl
     */
    var readFileAsDataURL = function (file) {
      return $.Deferred(function (deferred) {
        $.extend(new FileReader(), {
          onload: function (e) {
            var sDataURL = e.target.result;
            deferred.resolve(sDataURL);
          },
          onerror: function () {
            deferred.reject(this);
          }
        }).readAsDataURL(file);
      }).promise();
    };
  
    /**
     * @method createImage
     *
     * create `<image>` from url string
     *
     * @param {String} sUrl
     * @param {String} filename
     * @return {Promise} - then: $image
     */
    var createImage = function (sUrl, filename) {
      return $.Deferred(function (deferred) {
        var $img = $('<img>');

        $img.one('load', function () {
          $img.off('error abort');
          deferred.resolve($img);
        }).one('error abort', function () {
          $img.off('load').detach();
          deferred.reject($img);
        }).css({
          display: 'none'
        }).appendTo(document.body).attr({
          'src': sUrl,
          'data-filename': filename
        });
      }).promise();
    };

    return {
      readFileAsDataURL: readFileAsDataURL,
      createImage: createImage
    };
  })();

  /**
   * @class core.key
   *
   * Object for keycodes.
   *
   * @singleton
   * @alternateClassName key
   */
  var key = {
    /**
     * @method isEdit
     *
     * @param {Number} keyCode
     * @return {Boolean}
     */
    isEdit: function (keyCode) {
      return list.contains([8, 9, 13, 32], keyCode);
    },
    /**
     * @property {Object} nameFromCode
     * @property {String} nameFromCode.8 "BACKSPACE"
     */
    nameFromCode: {
      '8': 'BACKSPACE',
      '9': 'TAB',
      '13': 'ENTER',
      '32': 'SPACE',

      // Number: 0-9
      '48': 'NUM0',
      '49': 'NUM1',
      '50': 'NUM2',
      '51': 'NUM3',
      '52': 'NUM4',
      '53': 'NUM5',
      '54': 'NUM6',
      '55': 'NUM7',
      '56': 'NUM8',

      // Alphabet: a-z
      '66': 'B',
      '69': 'E',
      '73': 'I',
      '74': 'J',
      '75': 'K',
      '76': 'L',
      '82': 'R',
      '83': 'S',
      '85': 'U',
      '89': 'Y',
      '90': 'Z',

      '191': 'SLASH',
      '219': 'LEFTBRACKET',
      '220': 'BACKSLASH',
      '221': 'RIGHTBRACKET'
    }
  };

  /**
   * @class editing.Style
   *
   * Style
   *
   */
  var Style = function () {
    /**
     * @method jQueryCSS
     *
     * passing an array of style properties to .css()
     * will result in an object of property-value pairs.
     * (compability with version < 1.9)
     *
     * @private
     * @param  {jQuery} $obj
     * @param  {Array} propertyNames - An array of one or more CSS properties.
     * @return {Object}
     */
    var jQueryCSS = function ($obj, propertyNames) {
      if (agent.jqueryVersion < 1.9) {
        var result = {};
        $.each(propertyNames, function (idx, propertyName) {
          result[propertyName] = $obj.css(propertyName);
        });
        return result;
      }
      return $obj.css.call($obj, propertyNames);
    };

    /**
     * paragraph level style
     *
     * @param {WrappedRange} rng
     * @param {Object} styleInfo
     */
    this.stylePara = function (rng, styleInfo) {
      $.each(rng.nodes(dom.isPara, {
        includeAncestor: true
      }), function (idx, para) {
        $(para).css(styleInfo);
      });
    };

    /**
     * insert and returns styleNodes on range.
     *
     * @param {WrappedRange} rng
     * @param {Object} [options] - options for styleNodes
     * @param {String} [options.nodeName] - default: `SPAN`
     * @param {Boolean} [options.expandClosestSibling] - default: `false`
     * @param {Boolean} [options.onlyPartialContains] - default: `false`
     * @return {Node[]}
     */
    this.styleNodes = function (rng, options) {
      rng = rng.splitText();

      var nodeName = options && options.nodeName || 'SPAN';
      var expandClosestSibling = !!(options && options.expandClosestSibling);
      var onlyPartialContains = !!(options && options.onlyPartialContains);

      if (rng.isCollapsed()) {
        return rng.insertNode(dom.create(nodeName));
      }

      var pred = dom.makePredByNodeName(nodeName);
      var nodes = $.map(rng.nodes(dom.isText, {
        fullyContains: true
      }), function (text) {
        return dom.singleChildAncestor(text, pred) || dom.wrap(text, nodeName);
      });

      if (expandClosestSibling) {
        if (onlyPartialContains) {
          var nodesInRange = rng.nodes();
          // compose with partial contains predication
          pred = func.and(pred, function (node) {
            return list.contains(nodesInRange, node);
          });
        }

        return $.map(nodes, function (node) {
          var siblings = dom.withClosestSiblings(node, pred);
          var head = list.head(siblings);
          var tails = list.tail(siblings);
          $.each(tails, function (idx, elem) {
            dom.appendChildNodes(head, elem.childNodes);
            dom.remove(elem);
          });
          return list.head(siblings);
        });
      } else {
        return nodes;
      }
    };

    /**
     * get current style on cursor
     *
     * @param {WrappedRange} rng
     * @param {Node} target - target element on event
     * @return {Object} - object contains style properties.
     */
    this.current = function (rng, target) {
      var $cont = $(dom.isText(rng.sc) ? rng.sc.parentNode : rng.sc);
      var properties = ['font-family', 'font-size', 'text-align', 'list-style-type', 'line-height'];
      var styleInfo = jQueryCSS($cont, properties) || {};

      styleInfo['font-size'] = parseInt(styleInfo['font-size'], 10);

      // document.queryCommandState for toggle state
      styleInfo['font-bold'] = document.queryCommandState('bold') ? 'bold' : 'normal';
      styleInfo['font-italic'] = document.queryCommandState('italic') ? 'italic' : 'normal';
      styleInfo['font-underline'] = document.queryCommandState('underline') ? 'underline' : 'normal';
      styleInfo['font-strikethrough'] = document.queryCommandState('strikeThrough') ? 'strikethrough' : 'normal';
      styleInfo['font-superscript'] = document.queryCommandState('superscript') ? 'superscript' : 'normal';
      styleInfo['font-subscript'] = document.queryCommandState('subscript') ? 'subscript' : 'normal';

      // list-style-type to list-style(unordered, ordered)
      if (!rng.isOnList()) {
        styleInfo['list-style'] = 'none';
      } else {
        var aOrderedType = ['circle', 'disc', 'disc-leading-zero', 'square'];
        var isUnordered = $.inArray(styleInfo['list-style-type'], aOrderedType) > -1;
        styleInfo['list-style'] = isUnordered ? 'unordered' : 'ordered';
      }

      var para = dom.ancestor(rng.sc, dom.isPara);
      if (para && para.style['line-height']) {
        styleInfo['line-height'] = para.style.lineHeight;
      } else {
        var lineHeight = parseInt(styleInfo['line-height'], 10) / parseInt(styleInfo['font-size'], 10);
        styleInfo['line-height'] = lineHeight.toFixed(1);
      }

      styleInfo.image = dom.isImg(target) && target;
      styleInfo.anchor = rng.isOnAnchor() && dom.ancestor(rng.sc, dom.isAnchor);
      styleInfo.ancestors = dom.listAncestor(rng.sc, dom.isEditable);
      styleInfo.range = rng;

      return styleInfo;
    };
  };


  /**
   * @class editing.Typing
   *
   * Typing
   *
   */
  var Typing = function () {

    /**
     * insert tab
     *
     * @param {jQuery} $editable
     * @param {WrappedRange} rng
     * @param {Number} tabsize
     */
    this.insertTab = function ($editable, rng, tabsize) {
      var tab = dom.createText(new Array(tabsize + 1).join(dom.NBSP_CHAR));
      rng = rng.deleteContents();
      rng.insertNode(tab, true);

      rng = range.create(tab, tabsize);
      rng.select();
    };

    /**
     * insert paragraph
     */
    this.insertParagraph = function () {
      var rng = range.create();

      // deleteContents on range.
      rng = rng.deleteContents();

      // Wrap range if it needs to be wrapped by paragraph
      rng = rng.wrapBodyInlineWithPara();

      // finding paragraph
      var splitRoot = dom.ancestor(rng.sc, dom.isPara);

      var nextPara;
      // on paragraph: split paragraph
      if (splitRoot) {
        nextPara = dom.splitTree(splitRoot, rng.getStartPoint());

        var emptyAnchors = dom.listDescendant(splitRoot, dom.isEmptyAnchor);
        emptyAnchors = emptyAnchors.concat(dom.listDescendant(nextPara, dom.isEmptyAnchor));

        $.each(emptyAnchors, function (idx, anchor) {
          dom.remove(anchor);
        });
      // no paragraph: insert empty paragraph
      } else {
        var next = rng.sc.childNodes[rng.so];
        nextPara = $(dom.emptyPara)[0];
        if (next) {
          rng.sc.insertBefore(nextPara, next);
        } else {
          rng.sc.appendChild(nextPara);
        }
      }

      range.create(nextPara, 0).normalize().select();
    };

  };

  /**
   * @class editing.Table
   *
   * Table
   *
   */
  var Table = function () {
    /**
     * handle tab key
     *
     * @param {WrappedRange} rng
     * @param {Boolean} isShift
     */
    this.tab = function (rng, isShift) {
      var cell = dom.ancestor(rng.commonAncestor(), dom.isCell);
      var table = dom.ancestor(cell, dom.isTable);
      var cells = dom.listDescendant(table, dom.isCell);

      var nextCell = list[isShift ? 'prev' : 'next'](cells, cell);
      if (nextCell) {
        range.create(nextCell, 0).select();
      }
    };

    /**
     * create empty table element
     *
     * @param {Number} rowCount
     * @param {Number} colCount
     * @return {Node}
     */
    this.createTable = function (colCount, rowCount) {
      var tds = [], tdHTML;
      for (var idxCol = 0; idxCol < colCount; idxCol++) {
        tds.push('<td>' + dom.blank + '</td>');
      }
      tdHTML = tds.join('');

      var trs = [], trHTML;
      for (var idxRow = 0; idxRow < rowCount; idxRow++) {
        trs.push('<tr>' + tdHTML + '</tr>');
      }
      trHTML = trs.join('');
      return $('<table class="table table-bordered">' + trHTML + '</table>')[0];
    };
  };


  /**
   * @class editing.Bullet
   *
   * @alternateClassName Bullet
   */
  var Bullet = function () {
    /**
     * @method insertOrderedList
     *
     * toggle ordered list
     *
     * @type command
     */
    this.insertOrderedList = function () {
      this.toggleList('OL');
    };

    /**
     * @method insertUnorderedList
     *
     * toggle unordered list
     *
     * @type command
     */
    this.insertUnorderedList = function () {
      this.toggleList('UL');
    };

    /**
     * @method indent
     *
     * indent
     *
     * @type command
     */
    this.indent = function () {
      var self = this;
      var rng = range.create().wrapBodyInlineWithPara();

      var paras = rng.nodes(dom.isPara, { includeAncestor: true });
      var clustereds = list.clusterBy(paras, func.peq2('parentNode'));

      $.each(clustereds, function (idx, paras) {
        var head = list.head(paras);
        if (dom.isLi(head)) {
          self.wrapList(paras, head.parentNode.nodeName);
        } else {
          $.each(paras, function (idx, para) {
            $(para).css('marginLeft', function (idx, val) {
              return (parseInt(val, 10) || 0) + 25;
            });
          });
        }
      });

      rng.select();
    };

    /**
     * @method outdent
     *
     * outdent
     *
     * @type command
     */
    this.outdent = function () {
      var self = this;
      var rng = range.create().wrapBodyInlineWithPara();

      var paras = rng.nodes(dom.isPara, { includeAncestor: true });
      var clustereds = list.clusterBy(paras, func.peq2('parentNode'));

      $.each(clustereds, function (idx, paras) {
        var head = list.head(paras);
        if (dom.isLi(head)) {
          self.releaseList([paras]);
        } else {
          $.each(paras, function (idx, para) {
            $(para).css('marginLeft', function (idx, val) {
              val = (parseInt(val, 10) || 0);
              return val > 25 ? val - 25 : '';
            });
          });
        }
      });

      rng.select();
    };

    /**
     * @method toggleList
     *
     * toggle list
     *
     * @param {String} listName - OL or UL
     */
    this.toggleList = function (listName) {
      var self = this;
      var rng = range.create().wrapBodyInlineWithPara();

      var paras = rng.nodes(dom.isPara, { includeAncestor: true });
      var bookmark = rng.paraBookmark(paras);
      var clustereds = list.clusterBy(paras, func.peq2('parentNode'));

      // paragraph to list
      if (list.find(paras, dom.isPurePara)) {
        var wrappedParas = [];
        $.each(clustereds, function (idx, paras) {
          wrappedParas = wrappedParas.concat(self.wrapList(paras, listName));
        });
        paras = wrappedParas;
      // list to paragraph or change list style
      } else {
        var diffLists = rng.nodes(dom.isList, {
          includeAncestor: true
        }).filter(function (listNode) {
          return !$.nodeName(listNode, listName);
        });

        if (diffLists.length) {
          $.each(diffLists, function (idx, listNode) {
            dom.replace(listNode, listName);
          });
        } else {
          paras = this.releaseList(clustereds, true);
        }
      }

      range.createFromParaBookmark(bookmark, paras).select();
    };

    /**
     * @method wrapList
     *
     * @param {Node[]} paras
     * @param {String} listName
     * @return {Node[]}
     */
    this.wrapList = function (paras, listName) {
      var head = list.head(paras);
      var last = list.last(paras);

      var prevList = dom.isList(head.previousSibling) && head.previousSibling;
      var nextList = dom.isList(last.nextSibling) && last.nextSibling;

      var listNode = prevList || dom.insertAfter(dom.create(listName || 'UL'), last);

      // P to LI
      paras = $.map(paras, function (para) {
        return dom.isPurePara(para) ? dom.replace(para, 'LI') : para;
      });

      // append to list(<ul>, <ol>)
      dom.appendChildNodes(listNode, paras);

      if (nextList) {
        dom.appendChildNodes(listNode, list.from(nextList.childNodes));
        dom.remove(nextList);
      }

      return paras;
    };

    /**
     * @method releaseList
     *
     * @param {Array[]} clustereds
     * @param {Boolean} isEscapseToBody
     * @return {Node[]}
     */
    this.releaseList = function (clustereds, isEscapseToBody) {
      var releasedParas = [];

      $.each(clustereds, function (idx, paras) {
        var head = list.head(paras);
        var last = list.last(paras);

        var headList = isEscapseToBody ? dom.lastAncestor(head, dom.isList) :
                                         head.parentNode;
        var lastList = headList.childNodes.length > 1 ? dom.splitTree(headList, {
          node: last.parentNode,
          offset: dom.position(last) + 1
        }, true) : null;

        var middleList = dom.splitTree(headList, {
          node: head.parentNode,
          offset: dom.position(head)
        }, true);

        paras = isEscapseToBody ? dom.listDescendant(middleList, dom.isLi) :
                                  list.from(middleList.childNodes).filter(dom.isLi);

        // LI to P
        if (isEscapseToBody || !dom.isList(headList.parentNode)) {
          paras = $.map(paras, function (para) {
            return dom.replace(para, 'P');
          });
        }

        $.each(list.from(paras).reverse(), function (idx, para) {
          dom.insertAfter(para, headList);
        });

        // remove empty lists
        var rootLists = list.compact([headList, middleList, lastList]);
        $.each(rootLists, function (idx, rootList) {
          var listNodes = [rootList].concat(dom.listDescendant(rootList, dom.isList));
          $.each(listNodes.reverse(), function (idx, listNode) {
            if (!dom.nodeLength(listNode)) {
              dom.remove(listNode, true);
            }
          });
        });

        releasedParas = releasedParas.concat(paras);
      });

      return releasedParas;
    };
  };

  /**
   * @class editing.Editor
   *
   * Editor
   *
   */
  var Editor = function () {

    var style = new Style();
    var table = new Table();
    var typing = new Typing();
    var bullet = new Bullet();

    /**
     * @method createRange
     *
     * create range
     *
     * @param {jQuery} $editable
     * @return {WrappedRange}
     */
    this.createRange = function ($editable) {
      $editable.focus();
      return range.create();
    };

    /**
     * @method saveRange
     *
     * save current range
     *
     * @param {jQuery} $editable
     * @param {Boolean} [thenCollapse=false]
     */
    this.saveRange = function ($editable, thenCollapse) {
      $editable.focus();
      $editable.data('range', range.create());
      if (thenCollapse) {
        range.create().collapse().select();
      }
    };

    /**
     * @method saveRange
     *
     * save current node list to $editable.data('childNodes')
     *
     * @param {jQuery} $editable
     */
    this.saveNode = function ($editable) {
      // copy child node reference
      var copy = [];
      for (var key  = 0, len = $editable[0].childNodes.length; key < len; key++) {
        copy.push($editable[0].childNodes[key]);
      }
      $editable.data('childNodes', copy);
    };

    /**
     * @method restoreRange
     *
     * restore lately range
     *
     * @param {jQuery} $editable
     */
    this.restoreRange = function ($editable) {
      var rng = $editable.data('range');
      if (rng) {
        rng.select();
        $editable.focus();
      }
    };

    /**
     * @method restoreNode
     *
     * restore lately node list
     *
     * @param {jQuery} $editable
     */
    this.restoreNode = function ($editable) {
      $editable.html('');
      var child = $editable.data('childNodes');
      for (var index = 0, len = child.length; index < len; index++) {
        $editable[0].appendChild(child[index]);
      }
    };
    /**
     * @method currentStyle
     *
     * current style
     *
     * @param {Node} target
     * @return {Boolean} false if range is no
     */
    this.currentStyle = function (target) {
      var rng = range.create();
      return rng ? rng.isOnEditable() && style.current(rng, target) : false;
    };

    var triggerOnBeforeChange = this.triggerOnBeforeChange = function ($editable) {
      var onBeforeChange = $editable.data('callbacks').onBeforeChange;
      if (onBeforeChange) {
        onBeforeChange($editable.html(), $editable);
      }
    };

    var triggerOnChange = this.triggerOnChange = function ($editable) {
      var onChange = $editable.data('callbacks').onChange;
      if (onChange) {
        onChange($editable.html(), $editable);
      }
    };

    /**
     * @method undo
     * undo
     * @param {jQuery} $editable
     */
    this.undo = function ($editable) {
      triggerOnBeforeChange($editable);
      $editable.data('NoteHistory').undo();
      triggerOnChange($editable);
    };

    /**
     * @method redo
     * redo
     * @param {jQuery} $editable
     */
    this.redo = function ($editable) {
      triggerOnBeforeChange($editable);
      $editable.data('NoteHistory').redo();
      triggerOnChange($editable);
    };

    /**
     * @method beforeCommand
     * before command
     * @param {jQuery} $editable
     */
    var beforeCommand = this.beforeCommand = function ($editable) {
      triggerOnBeforeChange($editable);
    };

    /**
     * @method afterCommand
     * after command
     * @param {jQuery} $editable
     */
    var afterCommand = this.afterCommand = function ($editable) {
      $editable.data('NoteHistory').recordUndo();
      triggerOnChange($editable);
    };

    /**
     * @method bold
     * @param {jQuery} $editable
     * @param {Mixed} value
     */

    /**
     * @method italic
     * @param {jQuery} $editable
     * @param {Mixed} value
     */

    /**
     * @method underline
     * @param {jQuery} $editable
     * @param {Mixed} value
     */

    /**
     * @method strikethrough
     * @param {jQuery} $editable
     * @param {Mixed} value
     */

    /**
     * @method formatBlock
     * @param {jQuery} $editable
     * @param {Mixed} value
     */

    /**
     * @method superscript
     * @param {jQuery} $editable
     * @param {Mixed} value
     */

    /**
     * @method subscript
     * @param {jQuery} $editable
     * @param {Mixed} value
     */

    /**
     * @method justifyLeft
     * @param {jQuery} $editable
     * @param {Mixed} value
     */

    /**
     * @method justifyCenter
     * @param {jQuery} $editable
     * @param {Mixed} value
     */

    /**
     * @method justifyRight
     * @param {jQuery} $editable
     * @param {Mixed} value
     */

    /**
     * @method justifyFull
     * @param {jQuery} $editable
     * @param {Mixed} value
     */

    /**
     * @method formatBlock
     * @param {jQuery} $editable
     * @param {Mixed} value
     */

    /**
     * @method removeFormat
     * @param {jQuery} $editable
     * @param {Mixed} value
     */

    /**
     * @method backColor
     * @param {jQuery} $editable
     * @param {Mixed} value
     */

    /**
     * @method foreColor
     * @param {jQuery} $editable
     * @param {Mixed} value
     */

    /**
     * @method insertHorizontalRule
     * @param {jQuery} $editable
     * @param {Mixed} value
     */

    /**
     * @method fontName
     * @param {jQuery} $editable
     * @param {Mixed} value
     */

    /* jshint ignore:start */
    // native commands(with execCommand), generate function for execCommand
    var commands = ['bold', 'italic', 'underline', 'strikethrough', 'superscript', 'subscript',
                    'justifyLeft', 'justifyCenter', 'justifyRight', 'justifyFull',
                    'formatBlock', 'removeFormat',
                    'backColor', 'foreColor', 'insertHorizontalRule', 'fontName'];

    for (var idx = 0, len = commands.length; idx < len; idx ++) {
      this[commands[idx]] = (function (sCmd) {
        return function ($editable, value) {
          beforeCommand($editable);

          document.execCommand(sCmd, false, value);

          afterCommand($editable);
        };
      })(commands[idx]);
    }
    /* jshint ignore:end */

    /**
     * @method tab
     *
     * handle tab key
     *
     * @param {jQuery} $editable
     * @param {Object} options
     */
    this.tab = function ($editable, options) {
      var rng = range.create();
      if (rng.isCollapsed() && rng.isOnCell()) {
        table.tab(rng);
      } else {
        beforeCommand($editable);
        typing.insertTab($editable, rng, options.tabsize);
        afterCommand($editable);
      }
    };

    /**
     * @method untab
     *
     * handle shift+tab key
     *
     */
    this.untab = function () {
      var rng = range.create();
      if (rng.isCollapsed() && rng.isOnCell()) {
        table.tab(rng, true);
      }
    };

    /**
     * @method insertParagraph
     *
     * insert paragraph
     *
     * @param {Node} $editable
     */
    this.insertParagraph = function ($editable) {
      beforeCommand($editable);
      typing.insertParagraph($editable);
      afterCommand($editable);
    };

    /**
     * @method insertOrderedList
     *
     * @param {jQuery} $editable
     */
    this.insertOrderedList = function ($editable) {
      beforeCommand($editable);
      bullet.insertOrderedList($editable);
      afterCommand($editable);
    };

    /**
     * @param {jQuery} $editable
     */
    this.insertUnorderedList = function ($editable) {
      beforeCommand($editable);
      bullet.insertUnorderedList($editable);
      afterCommand($editable);
    };

    /**
     * @param {jQuery} $editable
     */
    this.indent = function ($editable) {
      beforeCommand($editable);
      bullet.indent($editable);
      afterCommand($editable);
    };

    /**
     * @param {jQuery} $editable
     */
    this.outdent = function ($editable) {
      beforeCommand($editable);
      bullet.outdent($editable);
      afterCommand($editable);
    };

    /**
     * insert image
     *
     * @param {jQuery} $editable
     * @param {String} sUrl
     */
    this.insertImage = function ($editable, sUrl, filename) {
      async.createImage(sUrl, filename).then(function ($image) {
        beforeCommand($editable);
        $image.css({
          display: '',
          width: Math.min($editable.width(), $image.width())
        });
        range.create().insertNode($image[0]);
        range.createFromNode($image[0]).collapse().select();
        afterCommand($editable);
      }).fail(function () {
        var callbacks = $editable.data('callbacks');
        if (callbacks.onImageUploadError) {
          callbacks.onImageUploadError();
        }
      });
    };

    /**
     * @method insertNode
     * insert node
     * @param {Node} $editable
     * @param {Node} node
     */
    this.insertNode = function ($editable, node) {
      beforeCommand($editable);
      var rng = this.createRange($editable);
      rng.insertNode(node);
      range.createFromNode(node).collapse().select();
      afterCommand($editable);
    };

    /**
     * insert text
     * @param {Node} $editable
     * @param {String} text
     */
    this.insertText = function ($editable, text) {
      beforeCommand($editable);
      var rng = this.createRange($editable);
      var textNode = rng.insertNode(dom.createText(text));
      range.create(textNode, dom.nodeLength(textNode)).select();
      afterCommand($editable);
    };

    /**
     * formatBlock
     *
     * @param {jQuery} $editable
     * @param {String} tagName
     */
    this.formatBlock = function ($editable, tagName) {
      beforeCommand($editable);
      tagName = agent.isMSIE ? '<' + tagName + '>' : tagName;
      document.execCommand('FormatBlock', false, tagName);
      afterCommand($editable);
    };

    this.formatPara = function ($editable) {
      beforeCommand($editable);
      this.formatBlock($editable, 'P');
      afterCommand($editable);
    };

    /* jshint ignore:start */
    for (var idx = 1; idx <= 6; idx ++) {
      this['formatH' + idx] = function (idx) {
        return function ($editable) {
          this.formatBlock($editable, 'H' + idx);
        };
      }(idx);
    };
    /* jshint ignore:end */

    /**
     * fontsize
     * FIXME: Still buggy
     *
     * @param {jQuery} $editable
     * @param {String} value - px
     */
    this.fontSize = function ($editable, value) {
      beforeCommand($editable);

      document.execCommand('fontSize', false, 3);
      if (agent.isFF) {
        // firefox: <font size="3"> to <span style='font-size={value}px;'>, buggy
        $editable.find('font[size=3]').removeAttr('size').css('font-size', value + 'px');
      } else {
        // chrome: <span style="font-size: medium"> to <span style='font-size={value}px;'>
        $editable.find('span').filter(function () {
          return this.style.fontSize === 'medium';
        }).css('font-size', value + 'px');
      }

      afterCommand($editable);
    };

    /**
     * lineHeight
     * @param {jQuery} $editable
     * @param {String} value
     */
    this.lineHeight = function ($editable, value) {
      beforeCommand($editable);
      style.stylePara(range.create(), {
        lineHeight: value
      });
      afterCommand($editable);
    };

    /**
     * unlink
     *
     * @type command
     *
     * @param {jQuery} $editable
     */
    this.unlink = function ($editable) {
      var rng = range.create();
      if (rng.isOnAnchor()) {
        var anchor = dom.ancestor(rng.sc, dom.isAnchor);
        rng = range.createFromNode(anchor);
        rng.select();

        beforeCommand($editable);
        document.execCommand('unlink');
        afterCommand($editable);
      }
    };

    /**
     * create link (command)
     *
     * @param {jQuery} $editable
     * @param {Object} linkInfo
     * @param {Object} options
     */
    this.createLink = function ($editable, linkInfo, options) {
      var linkUrl = linkInfo.url;
      var linkText = linkInfo.text;
      var isNewWindow = linkInfo.newWindow;
      var rng = linkInfo.range;
      var isTextChanged = rng.toString() !== linkText;

      beforeCommand($editable);

      if (options.onCreateLink) {
        linkUrl = options.onCreateLink(linkUrl);
      }

      var anchors;
      if (isTextChanged) {
        // Create a new link when text changed.
        var anchor = rng.insertNode($('<A>' + linkText + '</A>')[0]);
        anchors = [anchor];
      } else {
        anchors = style.styleNodes(rng, {
          nodeName: 'A',
          expandClosestSibling: true,
          onlyPartialContains: true
        });
      }

      $.each(anchors, function (idx, anchor) {
        $(anchor).attr({
          href: linkUrl,
          target: isNewWindow ? '_blank' : ''
        });
      });

      var startRange = range.createFromNode(list.head(anchors)).collapse(true);
      var startPoint = startRange.getStartPoint();
      var endRange = range.createFromNode(list.last(anchors)).collapse();
      var endPoint = endRange.getEndPoint();

      range.create(
        startPoint.node,
        startPoint.offset,
        endPoint.node,
        endPoint.offset
      ).select();

      afterCommand($editable);
    };

    /**
     * returns link info
     *
     * @return {Object}
     * @return {WrappedRange} return.range
     * @return {String} return.text
     * @return {Boolean} [return.isNewWindow=true]
     * @return {String} [return.url=""]
     */
    this.getLinkInfo = function ($editable) {
      $editable.focus();

      var rng = range.create().expand(dom.isAnchor);

      // Get the first anchor on range(for edit).
      var $anchor = $(list.head(rng.nodes(dom.isAnchor)));

      return {
        range: rng,
        text: rng.toString(),
        isNewWindow: $anchor.length ? $anchor.attr('target') === '_blank' : true,
        url: $anchor.length ? $anchor.attr('href') : ''
      };
    };

    /**
     * setting color
     *
     * @param {Node} $editable
     * @param {Object} sObjColor  color code
     * @param {String} sObjColor.foreColor foreground color
     * @param {String} sObjColor.backColor background color
     */
    this.color = function ($editable, sObjColor) {
      var oColor = JSON.parse(sObjColor);
      var foreColor = oColor.foreColor, backColor = oColor.backColor;

      beforeCommand($editable);

      if (foreColor) { document.execCommand('foreColor', false, foreColor); }
      if (backColor) { document.execCommand('backColor', false, backColor); }

      afterCommand($editable);
    };

    /**
     * insert Table
     *
     * @param {Node} $editable
     * @param {String} sDim dimension of table (ex : "5x5")
     */
    this.insertTable = function ($editable, sDim) {
      var dimension = sDim.split('x');
      beforeCommand($editable);

      var rng = range.create();
      rng = rng.deleteContents();
      rng.insertNode(table.createTable(dimension[0], dimension[1]));
      afterCommand($editable);
    };

    /**
     * float me
     *
     * @param {jQuery} $editable
     * @param {String} value
     * @param {jQuery} $target
     */
    this.floatMe = function ($editable, value, $target) {
      beforeCommand($editable);
      $target.css('float', value);
      afterCommand($editable);
    };

    /**
     * change image shape
     *
     * @param {jQuery} $editable
     * @param {String} value css class
     * @param {Node} $target
     */
    this.imageShape = function ($editable, value, $target) {
      beforeCommand($editable);

      $target.removeClass('img-rounded img-circle img-thumbnail');

      if (value) {
        $target.addClass(value);
      }

      afterCommand($editable);
    };

    /**
     * resize overlay element
     * @param {jQuery} $editable
     * @param {String} value
     * @param {jQuery} $target - target element
     */
    this.resize = function ($editable, value, $target) {
      beforeCommand($editable);

      $target.css({
        width: value * 100 + '%',
        height: ''
      });

      afterCommand($editable);
    };

    /**
     * @param {Position} pos
     * @param {jQuery} $target - target element
     * @param {Boolean} [bKeepRatio] - keep ratio
     */
    this.resizeTo = function (pos, $target, bKeepRatio) {
      var imageSize;
      if (bKeepRatio) {
        var newRatio = pos.y / pos.x;
        var ratio = $target.data('ratio');
        imageSize = {
          width: ratio > newRatio ? pos.x : pos.y / ratio,
          height: ratio > newRatio ? pos.x * ratio : pos.y
        };
      } else {
        imageSize = {
          width: pos.x,
          height: pos.y
        };
      }

      $target.css(imageSize);
    };

    /**
     * remove media object
     *
     * @param {jQuery} $editable
     * @param {String} value - dummy argument (for keep interface)
     * @param {jQuery} $target - target element
     */
    this.removeMedia = function ($editable, value, $target) {
      beforeCommand($editable);
      $target.detach();

      var callbacks = $editable.data('callbacks');
      if (callbacks && callbacks.onMediaDelete) {
        callbacks.onMediaDelete($target, this, $editable);
      }

      afterCommand($editable);
    };
  };

  /**
   * @class editing.History
   *
   * Editor History
   *
   */
  var History = function ($editable) {
    var stack = [], stackOffset = -1;
    var editable = $editable[0];

    var makeSnapshot = function () {
      var rng = range.create();
      var emptyBookmark = {s: {path: [0], offset: 0}, e: {path: [0], offset: 0}};

      return {
        contents: $editable.html(),
        bookmark: (rng ? rng.bookmark(editable) : emptyBookmark)
      };
    };

    var applySnapshot = function (snapshot) {
      if (snapshot.contents !== null) {
        $editable.html(snapshot.contents);
      }
      if (snapshot.bookmark !== null) {
        range.createFromBookmark(editable, snapshot.bookmark).select();
      }
    };

    /**
     * undo
     */
    this.undo = function () {
      if (0 < stackOffset) {
        stackOffset--;
        applySnapshot(stack[stackOffset]);
      }
    };

    /**
     * redo
     */
    this.redo = function () {
      if (stack.length - 1 > stackOffset) {
        stackOffset++;
        applySnapshot(stack[stackOffset]);
      }
    };

    /**
     * recorded undo
     */
    this.recordUndo = function () {
      stackOffset++;

      // Wash out stack after stackOffset
      if (stack.length > stackOffset) {
        stack = stack.slice(0, stackOffset);
      }

      // Create new snapshot and push it to the end
      stack.push(makeSnapshot());
    };

    // Create first undo stack
    this.recordUndo();
  };

  /**
   * @class module.Button
   *
   * Button
   */
  var Button = function () {
    /**
     * update button status
     *
     * @param {jQuery} $container
     * @param {Object} styleInfo
     */
    this.update = function ($container, styleInfo) {
      /**
       * handle dropdown's check mark (for fontname, fontsize, lineHeight).
       * @param {jQuery} $btn
       * @param {Number} value
       */
      var checkDropdownMenu = function ($btn, value) {
        $btn.find('.dropdown-menu li a').each(function () {
          // always compare string to avoid creating another func.
          var isChecked = ($(this).data('value') + '') === (value + '');
          this.className = isChecked ? 'checked' : '';
        });
      };

      /**
       * update button state(active or not).
       *
       * @private
       * @param {String} selector
       * @param {Function} pred
       */
      var btnState = function (selector, pred) {
        var $btn = $container.find(selector);
        $btn.toggleClass('active', pred());
      };

      if (styleInfo.image) {
        var $img = $(styleInfo.image);

        btnState('button[data-event="imageShape"][data-value="img-rounded"]', function () {
          return $img.hasClass('img-rounded');
        });
        btnState('button[data-event="imageShape"][data-value="img-circle"]', function () {
          return $img.hasClass('img-circle');
        });
        btnState('button[data-event="imageShape"][data-value="img-thumbnail"]', function () {
          return $img.hasClass('img-thumbnail');
        });
        btnState('button[data-event="imageShape"]:not([data-value])', function () {
          return !$img.is('.img-rounded, .img-circle, .img-thumbnail');
        });

        var imgFloat = $img.css('float');
        btnState('button[data-event="floatMe"][data-value="left"]', function () {
          return imgFloat === 'left';
        });
        btnState('button[data-event="floatMe"][data-value="right"]', function () {
          return imgFloat === 'right';
        });
        btnState('button[data-event="floatMe"][data-value="none"]', function () {
          return imgFloat !== 'left' && imgFloat !== 'right';
        });

        var style = $img.attr('style');
        btnState('button[data-event="resize"][data-value="1"]', function () {
          return !!/(^|\s)(max-)?width\s*:\s*100%/.test(style);
        });
        btnState('button[data-event="resize"][data-value="0.5"]', function () {
          return !!/(^|\s)(max-)?width\s*:\s*50%/.test(style);
        });
        btnState('button[data-event="resize"][data-value="0.25"]', function () {
          return !!/(^|\s)(max-)?width\s*:\s*25%/.test(style);
        });
        return;
      }

      // fontname
      var $fontname = $container.find('.note-fontname');
      if ($fontname.length) {
        var selectedFont = styleInfo['font-family'];
        if (!!selectedFont) {
          selectedFont = list.head(selectedFont.split(','));
          selectedFont = selectedFont.replace(/\'/g, '');
          $fontname.find('.note-current-fontname').text(selectedFont);
          checkDropdownMenu($fontname, selectedFont);
        }
      }

      // fontsize
      var $fontsize = $container.find('.note-fontsize');
      $fontsize.find('.note-current-fontsize').text(styleInfo['font-size']);
      checkDropdownMenu($fontsize, parseFloat(styleInfo['font-size']));

      // lineheight
      var $lineHeight = $container.find('.note-height');
      checkDropdownMenu($lineHeight, parseFloat(styleInfo['line-height']));

      btnState('button[data-event="bold"]', function () {
        return styleInfo['font-bold'] === 'bold';
      });
      btnState('button[data-event="italic"]', function () {
        return styleInfo['font-italic'] === 'italic';
      });
      btnState('button[data-event="underline"]', function () {
        return styleInfo['font-underline'] === 'underline';
      });
      btnState('button[data-event="strikethrough"]', function () {
        return styleInfo['font-strikethrough'] === 'strikethrough';
      });
      btnState('button[data-event="superscript"]', function () {
        return styleInfo['font-superscript'] === 'superscript';
      });
      btnState('button[data-event="subscript"]', function () {
        return styleInfo['font-subscript'] === 'subscript';
      });
      btnState('button[data-event="justifyLeft"]', function () {
        return styleInfo['text-align'] === 'left' || styleInfo['text-align'] === 'start';
      });
      btnState('button[data-event="justifyCenter"]', function () {
        return styleInfo['text-align'] === 'center';
      });
      btnState('button[data-event="justifyRight"]', function () {
        return styleInfo['text-align'] === 'right';
      });
      btnState('button[data-event="justifyFull"]', function () {
        return styleInfo['text-align'] === 'justify';
      });
      btnState('button[data-event="insertUnorderedList"]', function () {
        return styleInfo['list-style'] === 'unordered';
      });
      btnState('button[data-event="insertOrderedList"]', function () {
        return styleInfo['list-style'] === 'ordered';
      });
    };

    /**
     * update recent color
     *
     * @param {Node} button
     * @param {String} eventName
     * @param {Mixed} value
     */
    this.updateRecentColor = function (button, eventName, value) {
      var $color = $(button).closest('.note-color');
      var $recentColor = $color.find('.note-recent-color');
      var colorInfo = JSON.parse($recentColor.attr('data-value'));
      colorInfo[eventName] = value;
      $recentColor.attr('data-value', JSON.stringify(colorInfo));
      var sKey = eventName === 'backColor' ? 'background-color' : 'color';
      $recentColor.find('i').css(sKey, value);
    };
  };

  /**
   * @class module.Toolbar
   *
   * Toolbar
   */
  var Toolbar = function () {
    var button = new Button();

    this.update = function ($toolbar, styleInfo) {
      button.update($toolbar, styleInfo);
    };

    /**
     * @param {Node} button
     * @param {String} eventName
     * @param {String} value
     */
    this.updateRecentColor = function (buttonNode, eventName, value) {
      button.updateRecentColor(buttonNode, eventName, value);
    };

    /**
     * activate buttons exclude codeview
     * @param {jQuery} $toolbar
     */
    this.activate = function ($toolbar) {
      $toolbar.find('button')
              .not('button[data-event="codeview"]')
              .removeClass('disabled');
    };

    /**
     * deactivate buttons exclude codeview
     * @param {jQuery} $toolbar
     */
    this.deactivate = function ($toolbar) {
      $toolbar.find('button')
              .not('button[data-event="codeview"]')
              .addClass('disabled');
    };

    /**
     *
     * @param {jQuery} $container
     * @param {Boolean} [bFullscreen=false]
     */
    this.updateFullscreen = function ($container, bFullscreen) {
      var $btn = $container.find('button[data-event="fullscreen"]');
      $btn.toggleClass('active', bFullscreen);
    };

    /**
     *
     * @param {jQuery} $container
     * @param {Boolean} [isCodeview=false]
     */
    this.updateCodeview = function ($container, isCodeview) {
      var $btn = $container.find('button[data-event="codeview"]');
      $btn.toggleClass('active', isCodeview);
    };
  };

  /**
   * @class module.Popover
   *
   * Popover (http://getbootstrap.com/javascript/#popovers)
   *
   */
  var Popover = function () {
    var button = new Button();

    /**
     * returns position from placeholder
     *
     * @private
     * @param {Node} placeholder
     * @param {Boolean} isAirMode
     * @return {Object}
     * @return {Number} return.left
     * @return {Number} return.top
     */
    var posFromPlaceholder = function (placeholder, isAirMode) {
      var $placeholder = $(placeholder);
      var pos = isAirMode ? $placeholder.offset() : $placeholder.position();
      var height = $placeholder.outerHeight(true); // include margin

      // popover below placeholder.
      return {
        left: pos.left,
        top: pos.top + height
      };
    };

    /**
     * show popover
     *
     * @private
     * @param {jQuery} popover
     * @param {Position} pos
     */
    var showPopover = function ($popover, pos) {
      $popover.css({
        display: 'block',
        left: pos.left,
        top: pos.top
      });
    };

    var PX_POPOVER_ARROW_OFFSET_X = 20;

    /**
     * update current state
     * @param {jQuery} $popover - popover container
     * @param {Object} styleInfo - style object
     * @param {Boolean} isAirMode
     */
    this.update = function ($popover, styleInfo, isAirMode) {
      button.update($popover, styleInfo);

      var $linkPopover = $popover.find('.note-link-popover');
      if (styleInfo.anchor) {
        var $anchor = $linkPopover.find('a');
        var href = $(styleInfo.anchor).attr('href');
        $anchor.attr('href', href).html(href);
        showPopover($linkPopover, posFromPlaceholder(styleInfo.anchor, isAirMode));
      } else {
        $linkPopover.hide();
      }

      var $imagePopover = $popover.find('.note-image-popover');
      if (styleInfo.image) {
        showPopover($imagePopover, posFromPlaceholder(styleInfo.image, isAirMode));
      } else {
        $imagePopover.hide();
      }

      var $airPopover = $popover.find('.note-air-popover');
      if (isAirMode && !styleInfo.range.isCollapsed()) {
        var rect = list.last(styleInfo.range.getClientRects());
        if (rect) {
          var bnd = func.rect2bnd(rect);
          showPopover($airPopover, {
            left: Math.max(bnd.left + bnd.width / 2 - PX_POPOVER_ARROW_OFFSET_X, 0),
            top: bnd.top + bnd.height
          });
        }
      } else {
        $airPopover.hide();
      }
    };

    /**
     * @param {Node} button
     * @param {String} eventName
     * @param {String} value
     */
    this.updateRecentColor = function (button, eventName, value) {
      button.updateRecentColor(button, eventName, value);
    };

    /**
     * hide all popovers
     * @param {jQuery} $popover - popover container
     */
    this.hide = function ($popover) {
      $popover.children().hide();
    };
  };

  /**
   * @class module.Handle
   *
   * Handle
   */
  var Handle = function () {
    /**
     * update handle
     * @param {jQuery} $handle
     * @param {Object} styleInfo
     * @param {Boolean} isAirMode
     */
    this.update = function ($handle, styleInfo, isAirMode) {
      var $selection = $handle.find('.note-control-selection');
      if (styleInfo.image) {
        var $image = $(styleInfo.image);
        var pos = isAirMode ? $image.offset() : $image.position();

        // include margin
        var imageSize = {
          w: $image.outerWidth(true),
          h: $image.outerHeight(true)
        };

        $selection.css({
          display: 'block',
          left: pos.left,
          top: pos.top,
          width: imageSize.w,
          height: imageSize.h
        }).data('target', styleInfo.image); // save current image element.
        var sizingText = imageSize.w + 'x' + imageSize.h;
        $selection.find('.note-control-selection-info').text(sizingText);
      } else {
        $selection.hide();
      }
    };

    /**
     * hide
     *
     * @param {jQuery} $handle
     */
    this.hide = function ($handle) {
      $handle.children().hide();
    };
  };

  /**
   * @class module.Dialog
   *
   * Dialog
   *
   */
  var Dialog = function () {

    /**
     * toggle button status
     *
     * @private
     * @param {jQuery} $btn
     * @param {Boolean} isEnable
     */
    var toggleBtn = function ($btn, isEnable) {
      $btn.toggleClass('disabled', !isEnable);
      $btn.attr('disabled', !isEnable);
    };

    /**
     * show image dialog
     *
     * @param {jQuery} $editable
     * @param {jQuery} $dialog
     * @return {Promise}
     */
    this.showImageDialog = function ($editable, $dialog) {
      return $.Deferred(function (deferred) {
        var $imageDialog = $dialog.find('.note-image-dialog');

        var $imageInput = $dialog.find('.note-image-input'),
            $imageUrl = $dialog.find('.note-image-url'),
            $imageBtn = $dialog.find('.note-image-btn');

        $imageDialog.one('shown.bs.modal', function () {
          // Cloning imageInput to clear element.
          $imageInput.replaceWith($imageInput.clone()
            .on('change', function () {
              deferred.resolve(this.files || this.value);
              $imageDialog.modal('hide');
            })
            .val('')
          );

          $imageBtn.click(function (event) {
            event.preventDefault();

            deferred.resolve($imageUrl.val());
            $imageDialog.modal('hide');
          });

          $imageUrl.on('keyup paste', function (event) {
            var url;
            
            if (event.type === 'paste') {
              url = event.originalEvent.clipboardData.getData('text');
            } else {
              url = $imageUrl.val();
            }
            
            toggleBtn($imageBtn, url);
          }).val('').trigger('focus');
        }).one('hidden.bs.modal', function () {
          $imageInput.off('change');
          $imageUrl.off('keyup paste');
          $imageBtn.off('click');

          if (deferred.state() === 'pending') {
            deferred.reject();
          }
        }).modal('show');
      });
    };

    /**
     * Show link dialog and set event handlers on dialog controls.
     *
     * @param {jQuery} $editable
     * @param {jQuery} $dialog
     * @param {Object} linkInfo
     * @return {Promise}
     */
    this.showLinkDialog = function ($editable, $dialog, linkInfo) {
      return $.Deferred(function (deferred) {
        var $linkDialog = $dialog.find('.note-link-dialog');

        var $linkText = $linkDialog.find('.note-link-text'),
        $linkUrl = $linkDialog.find('.note-link-url'),
        $linkBtn = $linkDialog.find('.note-link-btn'),
        $openInNewWindow = $linkDialog.find('input[type=checkbox]');

        $linkDialog.one('shown.bs.modal', function () {
          $linkText.val(linkInfo.text);

          $linkText.on('input', function () {
            // if linktext was modified by keyup,
            // stop cloning text from linkUrl
            linkInfo.text = $linkText.val();
          });

          // if no url was given, copy text to url
          if (!linkInfo.url) {
            linkInfo.url = linkInfo.text;
            toggleBtn($linkBtn, linkInfo.text);
          }

          $linkUrl.on('input', function () {
            toggleBtn($linkBtn, $linkUrl.val());
            // display same link on `Text to display` input
            // when create a new link
            if (!linkInfo.text) {
              $linkText.val($linkUrl.val());
            }
          }).val(linkInfo.url).trigger('focus').trigger('select');

          $openInNewWindow.prop('checked', linkInfo.newWindow);

          $linkBtn.one('click', function (event) {
            event.preventDefault();

            deferred.resolve({
              range: linkInfo.range,
              url: $linkUrl.val(),
              text: $linkText.val(),
              newWindow: $openInNewWindow.is(':checked')
            });
            $linkDialog.modal('hide');
          });
        }).one('hidden.bs.modal', function () {
          // detach events
          $linkText.off('input');
          $linkUrl.off('input');
          $linkBtn.off('click');

          if (deferred.state() === 'pending') {
            deferred.reject();
          }
        }).modal('show');
      }).promise();
    };

    /**
     * show help dialog
     *
     * @param {jQuery} $editable
     * @param {jQuery} $dialog
     * @return {Promise}
     */
    this.showHelpDialog = function ($editable, $dialog) {
      return $.Deferred(function (deferred) {
        var $helpDialog = $dialog.find('.note-help-dialog');

        $helpDialog.one('hidden.bs.modal', function () {
          deferred.resolve();
        }).modal('show');
      }).promise();
    };
  };


  var CodeMirror;
  if (agent.hasCodeMirror) {
    if (agent.isSupportAmd) {
      require(['CodeMirror'], function (cm) {
        CodeMirror = cm;
      });
    } else {
      CodeMirror = window.CodeMirror;
    }
  }

  /**
   * @class EventHandler
   *
   * EventHandler
   */
  var EventHandler = function () {
    var $window = $(window);
    var $document = $(document);
    var $scrollbar = $('html, body');

    var editor = new Editor();
    var toolbar = new Toolbar(), popover = new Popover();
    var handle = new Handle(), dialog = new Dialog();

    /**
     * get editor
     * @returns {editing.Editor}
     */
    this.getEditor = function () {
      return editor;
    };

    /**
     * returns makeLayoutInfo from editor's descendant node.
     *
     * @private
     * @param {Node} descendant
     * @return {Object}
     */
    var makeLayoutInfo = function (descendant) {
      var $target = $(descendant).closest('.note-editor, .note-air-editor, .note-air-layout');

      if (!$target.length) { return null; }

      var $editor;
      if ($target.is('.note-editor, .note-air-editor')) {
        $editor = $target;
      } else {
        $editor = $('#note-editor-' + list.last($target.attr('id').split('-')));
      }

      return dom.buildLayoutInfo($editor);
    };

    /**
     * insert Images from file array.
     *
     * @private
     * @param {Object} layoutInfo
     * @param {File[]} files
     */
    var insertImages = function (layoutInfo, files) {
      var $editor = layoutInfo.editor(),
          $editable = layoutInfo.editable();

      var callbacks = $editable.data('callbacks');
      var options = $editor.data('options');

      // If onImageUpload options setted
      if (callbacks.onImageUpload) {
        callbacks.onImageUpload(files, editor, $editable);
      // else insert Image as dataURL
      } else {
        $.each(files, function (idx, file) {
          var filename = file.name;
          if (options.maximumImageFileSize && options.maximumImageFileSize < file.size) {
            if (callbacks.onImageUploadError) {
              callbacks.onImageUploadError(options.langInfo.image.maximumFileSizeError);
            } else {
              alert(options.langInfo.image.maximumFileSizeError);
            }
          } else {
            async.readFileAsDataURL(file).then(function (sDataURL) {
              editor.insertImage($editable, sDataURL, filename);
            }).fail(function () {
              if (callbacks.onImageUploadError) {
                callbacks.onImageUploadError();
              }
            });
          }
        });
      }
    };

    var commands = {
      /**
       * @param {Object} layoutInfo
       */
      showLinkDialog: function (layoutInfo) {
        var $editor = layoutInfo.editor(),
            $dialog = layoutInfo.dialog(),
            $editable = layoutInfo.editable(),
            linkInfo = editor.getLinkInfo($editable);

        var options = $editor.data('options');

        editor.saveRange($editable);
        dialog.showLinkDialog($editable, $dialog, linkInfo).then(function (linkInfo) {
          editor.restoreRange($editable);
          editor.createLink($editable, linkInfo, options);
          // hide popover after creating link
          popover.hide(layoutInfo.popover());
        }).fail(function () {
          editor.restoreRange($editable);
        });
      },

      /**
       * @param {Object} layoutInfo
       */
      showImageDialog: function (layoutInfo) {
        var $dialog = layoutInfo.dialog(),
            $editable = layoutInfo.editable();

        editor.saveRange($editable);
        dialog.showImageDialog($editable, $dialog).then(function (data) {
          editor.restoreRange($editable);

          if (typeof data === 'string') {
            // image url
            editor.insertImage($editable, data);
          } else {
            // array of files
            insertImages(layoutInfo, data);
          }
        }).fail(function () {
          editor.restoreRange($editable);
        });
      },

      /**
       * @param {Object} layoutInfo
       */
      showHelpDialog: function (layoutInfo) {
        var $dialog = layoutInfo.dialog(),
            $editable = layoutInfo.editable();

        editor.saveRange($editable, true);
        dialog.showHelpDialog($editable, $dialog).then(function () {
          editor.restoreRange($editable);
        });
      },

      fullscreen: function (layoutInfo) {
        var $editor = layoutInfo.editor(),
        $toolbar = layoutInfo.toolbar(),
        $editable = layoutInfo.editable(),
        $codable = layoutInfo.codable();

        var resize = function (size) {
          $editable.css('height', size.h);
          $codable.css('height', size.h);
          if ($codable.data('cmeditor')) {
            $codable.data('cmeditor').setsize(null, size.h);
          }
        };

        $editor.toggleClass('fullscreen');
        var isFullscreen = $editor.hasClass('fullscreen');
        if (isFullscreen) {
          $editable.data('orgheight', $editable.css('height'));

          $window.on('resize', function () {
            resize({
              h: $window.height() - $toolbar.outerHeight()
            });
          }).trigger('resize');

          $scrollbar.css('overflow', 'hidden');
        } else {
          $window.off('resize');
          resize({
            h: $editable.data('orgheight')
          });
          $scrollbar.css('overflow', 'visible');
        }

        toolbar.updateFullscreen($toolbar, isFullscreen);
      },

      codeview: function (layoutInfo) {
        var $editor = layoutInfo.editor(),
        $toolbar = layoutInfo.toolbar(),
        $editable = layoutInfo.editable(),
        $codable = layoutInfo.codable(),
        $popover = layoutInfo.popover(),
        $handle = layoutInfo.handle();

        var options = $editor.data('options');

        var cmEditor, server;

        $editor.toggleClass('codeview');

        var isCodeview = $editor.hasClass('codeview');
        if (isCodeview) {
          $codable.val(dom.html($editable, options.prettifyHtml));
          $codable.height($editable.height());
          toolbar.deactivate($toolbar);
          popover.hide($popover);
          handle.hide($handle);
          $codable.focus();

          // activate CodeMirror as codable
          if (agent.hasCodeMirror) {
            cmEditor = CodeMirror.fromTextArea($codable[0], options.codemirror);

            // CodeMirror TernServer
            if (options.codemirror.tern) {
              server = new CodeMirror.TernServer(options.codemirror.tern);
              cmEditor.ternServer = server;
              cmEditor.on('cursorActivity', function (cm) {
                server.updateArgHints(cm);
              });
            }

            // CodeMirror hasn't Padding.
            cmEditor.setSize(null, $editable.outerHeight());
            $codable.data('cmEditor', cmEditor);
          }
        } else {
          // deactivate CodeMirror as codable
          if (agent.hasCodeMirror) {
            cmEditor = $codable.data('cmEditor');
            $codable.val(cmEditor.getValue());
            cmEditor.toTextArea();
          }

          $editable.html(dom.value($codable, options.prettifyHtml) || dom.emptyPara);
          $editable.height(options.height ? $codable.height() : 'auto');

          toolbar.activate($toolbar);
          $editable.focus();
        }

        toolbar.updateCodeview(layoutInfo.toolbar(), isCodeview);
      }
    };

    var hMousedown = function (event) {
      //preventDefault Selection for FF, IE8+
      if (dom.isImg(event.target)) {
        event.preventDefault();
      }
    };

    var hToolbarAndPopoverUpdate = function (event) {
      // delay for range after mouseup
      setTimeout(function () {
        var layoutInfo = makeLayoutInfo(event.currentTarget || event.target);
        var styleInfo = editor.currentStyle(event.target);
        if (!styleInfo) { return; }

        var isAirMode = layoutInfo.editor().data('options').airMode;
        if (!isAirMode) {
          toolbar.update(layoutInfo.toolbar(), styleInfo);
        }

        popover.update(layoutInfo.popover(), styleInfo, isAirMode);
        handle.update(layoutInfo.handle(), styleInfo, isAirMode);
      }, 0);
    };

    var hScroll = function (event) {
      var layoutInfo = makeLayoutInfo(event.currentTarget || event.target);
      //hide popover and handle when scrolled
      popover.hide(layoutInfo.popover());
      handle.hide(layoutInfo.handle());
    };

    /**
     * paste clipboard image
     *
     * @param {Event} event
     */
    var hPasteClipboardImage = function (event) {
      var clipboardData = event.originalEvent.clipboardData;
      var layoutInfo = makeLayoutInfo(event.currentTarget || event.target);
      var $editable = layoutInfo.editable();

      if (!clipboardData || !clipboardData.items || !clipboardData.items.length) {
        var callbacks = $editable.data('callbacks');
        // only can run if it has onImageUpload method
        if (!callbacks.onImageUpload) {
          return;
        }

        // save cursor
        editor.saveNode($editable);
        editor.saveRange($editable);

        $editable.html('');

        setTimeout(function () {
          var $img = $editable.find('img');
          var datauri = $img[0].src;

          var data = atob(datauri.split(',')[1]);
          var array = new Uint8Array(data.length);
          for (var i = 0; i < data.length; i++) {
            array[i] = data.charCodeAt(i);
          }

          var blob = new Blob([array], { type : 'image/png'});
          blob.name = 'clipboard.png';

          editor.restoreNode($editable);
          editor.restoreRange($editable);
          insertImages(layoutInfo, [blob]);

          editor.afterCommand($editable);
        }, 0);

        return;
      }

      var item = list.head(clipboardData.items);
      var isClipboardImage = item.kind === 'file' && item.type.indexOf('image/') !== -1;

      if (isClipboardImage) {
        insertImages(layoutInfo, [item.getAsFile()]);
      }

      editor.afterCommand($editable);
    };

    /**
     * `mousedown` event handler on $handle
     *  - controlSizing: resize image
     *
     * @param {MouseEvent} event
     */
    var hHandleMousedown = function (event) {
      if (dom.isControlSizing(event.target)) {
        event.preventDefault();
        event.stopPropagation();

        var layoutInfo = makeLayoutInfo(event.target),
            $handle = layoutInfo.handle(), $popover = layoutInfo.popover(),
            $editable = layoutInfo.editable(),
            $editor = layoutInfo.editor();

        var target = $handle.find('.note-control-selection').data('target'),
            $target = $(target), posStart = $target.offset(),
            scrollTop = $document.scrollTop();

        var isAirMode = $editor.data('options').airMode;

        $document.on('mousemove', function (event) {
          editor.resizeTo({
            x: event.clientX - posStart.left,
            y: event.clientY - (posStart.top - scrollTop)
          }, $target, !event.shiftKey);

          handle.update($handle, {image: target}, isAirMode);
          popover.update($popover, {image: target}, isAirMode);
        }).one('mouseup', function () {
          $document.off('mousemove');
          editor.afterCommand($editable);
        });

        if (!$target.data('ratio')) { // original ratio.
          $target.data('ratio', $target.height() / $target.width());
        }
      }
    };

    var hToolbarAndPopoverMousedown = function (event) {
      // prevent default event when insertTable (FF, Webkit)
      var $btn = $(event.target).closest('[data-event]');
      if ($btn.length) {
        event.preventDefault();
      }
    };

    var hToolbarAndPopoverClick = function (event) {
      var $btn = $(event.target).closest('[data-event]');

      if ($btn.length) {
        var eventName = $btn.attr('data-event'),
            value = $btn.attr('data-value'),
            hide = $btn.attr('data-hide');

        var layoutInfo = makeLayoutInfo(event.target);

        // before command: detect control selection element($target)
        var $target;
        if ($.inArray(eventName, ['resize', 'floatMe', 'removeMedia', 'imageShape']) !== -1) {
          var $selection = layoutInfo.handle().find('.note-control-selection');
          $target = $($selection.data('target'));
        }

        // If requested, hide the popover when the button is clicked.
        // Useful for things like showHelpDialog.
        if (hide) {
          $btn.parents('.popover').hide();
        }

        if ($.isFunction($.summernote.pluginEvents[eventName])) {
          $.summernote.pluginEvents[eventName](event, editor, layoutInfo, value);
        } else if (editor[eventName]) { // on command
          var $editable = layoutInfo.editable();
          $editable.trigger('focus');
          editor[eventName]($editable, value, $target);
          event.preventDefault();
        } else if (commands[eventName]) {
          commands[eventName].call(this, layoutInfo);
          event.preventDefault();
        }

        // after command
        if ($.inArray(eventName, ['backColor', 'foreColor']) !== -1) {
          var options = layoutInfo.editor().data('options', options);
          var module = options.airMode ? popover : toolbar;
          module.updateRecentColor(list.head($btn), eventName, value);
        }

        hToolbarAndPopoverUpdate(event);
      }
    };

    var EDITABLE_PADDING = 24;
    /**
     * `mousedown` event handler on statusbar
     *
     * @param {MouseEvent} event
     */
    var hStatusbarMousedown = function (event) {
      event.preventDefault();
      event.stopPropagation();

      var $editable = makeLayoutInfo(event.target).editable();
      var nEditableTop = $editable.offset().top - $document.scrollTop();

      var layoutInfo = makeLayoutInfo(event.currentTarget || event.target);
      var options = layoutInfo.editor().data('options');

      $document.on('mousemove', function (event) {
        var nHeight = event.clientY - (nEditableTop + EDITABLE_PADDING);

        nHeight = (options.minHeight > 0) ? Math.max(nHeight, options.minHeight) : nHeight;
        nHeight = (options.maxHeight > 0) ? Math.min(nHeight, options.maxHeight) : nHeight;

        $editable.height(nHeight);
      }).one('mouseup', function () {
        $document.off('mousemove');
      });
    };

    var PX_PER_EM = 18;
    var hDimensionPickerMove = function (event, options) {
      var $picker = $(event.target.parentNode); // target is mousecatcher
      var $dimensionDisplay = $picker.next();
      var $catcher = $picker.find('.note-dimension-picker-mousecatcher');
      var $highlighted = $picker.find('.note-dimension-picker-highlighted');
      var $unhighlighted = $picker.find('.note-dimension-picker-unhighlighted');

      var posOffset;
      // HTML5 with jQuery - e.offsetX is undefined in Firefox
      if (event.offsetX === undefined) {
        var posCatcher = $(event.target).offset();
        posOffset = {
          x: event.pageX - posCatcher.left,
          y: event.pageY - posCatcher.top
        };
      } else {
        posOffset = {
          x: event.offsetX,
          y: event.offsetY
        };
      }

      var dim = {
        c: Math.ceil(posOffset.x / PX_PER_EM) || 1,
        r: Math.ceil(posOffset.y / PX_PER_EM) || 1
      };

      $highlighted.css({ width: dim.c + 'em', height: dim.r + 'em' });
      $catcher.attr('data-value', dim.c + 'x' + dim.r);

      if (3 < dim.c && dim.c < options.insertTableMaxSize.col) {
        $unhighlighted.css({ width: dim.c + 1 + 'em'});
      }

      if (3 < dim.r && dim.r < options.insertTableMaxSize.row) {
        $unhighlighted.css({ height: dim.r + 1 + 'em'});
      }

      $dimensionDisplay.html(dim.c + ' x ' + dim.r);
    };

    /**
     * Drag and Drop Events
     *
     * @param {Object} layoutInfo - layout Informations
     * @param {Object} options
     */
    var handleDragAndDropEvent = function (layoutInfo, options) {
      if (options.disableDragAndDrop) {
        // prevent default drop event
        $document.on('drop', function (e) {
          e.preventDefault();
        });
      } else {
        attachDragAndDropEvent(layoutInfo, options);
      }
    };

    /**
     * attach Drag and Drop Events
     *
     * @param {Object} layoutInfo - layout Informations
     * @param {Object} options
     */
    var attachDragAndDropEvent = function (layoutInfo, options) {
      var collection = $(),
          $dropzone = layoutInfo.dropzone,
          $dropzoneMessage = layoutInfo.dropzone.find('.note-dropzone-message');

      // show dropzone on dragenter when dragging a object to document.
      $document.on('dragenter', function (e) {
        var isCodeview = layoutInfo.editor.hasClass('codeview');
        if (!isCodeview && !collection.length) {
          layoutInfo.editor.addClass('dragover');
          $dropzone.width(layoutInfo.editor.width());
          $dropzone.height(layoutInfo.editor.height());
          $dropzoneMessage.text(options.langInfo.image.dragImageHere);
        }
        collection = collection.add(e.target);
      }).on('dragleave', function (e) {
        collection = collection.not(e.target);
        if (!collection.length) {
          layoutInfo.editor.removeClass('dragover');
        }
      }).on('drop', function () {
        collection = $();
        layoutInfo.editor.removeClass('dragover');
      }).on('mouseout', function (e) {
        collection = collection.not(e.target);
        if (!collection.length) {
          layoutInfo.editor.removeClass('dragover');
        }
      });

      // change dropzone's message on hover.
      $dropzone.on('dragenter', function () {
        $dropzone.addClass('hover');
        $dropzoneMessage.text(options.langInfo.image.dropImage);
      }).on('dragleave', function () {
        $dropzone.removeClass('hover');
        $dropzoneMessage.text(options.langInfo.image.dragImageHere);
      });

      // attach dropImage
      $dropzone.on('drop', function (event) {
        event.preventDefault();

        var dataTransfer = event.originalEvent.dataTransfer;
        var html = dataTransfer.getData('text/html');
        var text = dataTransfer.getData('text/plain');

        var layoutInfo = makeLayoutInfo(event.currentTarget || event.target);

        if (dataTransfer && dataTransfer.files && dataTransfer.files.length) {
          layoutInfo.editable().focus();
          insertImages(layoutInfo, dataTransfer.files);
        } else if (html) {
          $(html).each(function () {
            layoutInfo.editable().focus();
            editor.insertNode(layoutInfo.editable(), this);
          });
        } else if (text) {
          layoutInfo.editable().focus();
          editor.insertText(layoutInfo.editable(), text);
        }
      }).on('dragover', false); // prevent default dragover event
    };


    /**
     * bind KeyMap on keydown
     *
     * @param {Object} layoutInfo
     * @param {Object} keyMap
     */
    this.bindKeyMap = function (layoutInfo, keyMap) {
      var $editor = layoutInfo.editor;
      var $editable = layoutInfo.editable;

      layoutInfo = makeLayoutInfo($editable);

      $editable.on('keydown', function (event) {
        var aKey = [];

        // modifier
        if (event.metaKey) { aKey.push('CMD'); }
        if (event.ctrlKey && !event.altKey) { aKey.push('CTRL'); }
        if (event.shiftKey) { aKey.push('SHIFT'); }

        // keycode
        var keyName = key.nameFromCode[event.keyCode];
        if (keyName) { aKey.push(keyName); }

        var eventName = keyMap[aKey.join('+')];
        if (eventName) {
          if ($.summernote.pluginEvents[eventName]) {
            var plugin = $.summernote.pluginEvents[eventName];
            if ($.isFunction(plugin)) {
              plugin(event, editor, layoutInfo);
            }
          } else if (editor[eventName]) {
            editor[eventName]($editable, $editor.data('options'));
            event.preventDefault();
          } else if (commands[eventName]) {
            commands[eventName].call(this, layoutInfo);
            event.preventDefault();
          }
        } else if (key.isEdit(event.keyCode)) {
          editor.afterCommand($editable);
        }
      });
    };

    /**
     * attach eventhandler
     *
     * @param {Object} layoutInfo - layout Informations
     * @param {Object} options - user options include custom event handlers
     * @param {function(event)} [options.onenter] - enter key handler
     * @param {function(event)} [options.onfocus]
     * @param {function(event)} [options.onblur]
     * @param {function(event)} [options.onkeyup]
     * @param {function(event)} [options.onkeydown]
     * @param {function(event)} [options.onpaste]
     * @param {function(event)} [options.onToolBarclick]
     * @param {function(event)} [options.onChange]
     */
    this.attach = function (layoutInfo, options) {
      // handlers for editable
      if (options.shortcuts) {
        this.bindKeyMap(layoutInfo, options.keyMap[agent.isMac ? 'mac' : 'pc']);
      }
      layoutInfo.editable.on('mousedown', hMousedown);
      layoutInfo.editable.on('keyup mouseup', hToolbarAndPopoverUpdate);
      layoutInfo.editable.on('scroll', hScroll);
      layoutInfo.editable.on('paste', hPasteClipboardImage);

      // handler for handle and popover
      layoutInfo.handle.on('mousedown', hHandleMousedown);
      layoutInfo.popover.on('click', hToolbarAndPopoverClick);
      layoutInfo.popover.on('mousedown', hToolbarAndPopoverMousedown);

      // handlers for frame mode (toolbar, statusbar)
      if (!options.airMode) {
        // handler for drag and drop
        handleDragAndDropEvent(layoutInfo, options);

        // handler for toolbar
        layoutInfo.toolbar.on('click', hToolbarAndPopoverClick);
        layoutInfo.toolbar.on('mousedown', hToolbarAndPopoverMousedown);

        // handler for statusbar
        if (!options.disableResizeEditor) {
          layoutInfo.statusbar.on('mousedown', hStatusbarMousedown);
        }
      }

      // handler for table dimension
      var $catcherContainer = options.airMode ? layoutInfo.popover :
                                                layoutInfo.toolbar;
      var $catcher = $catcherContainer.find('.note-dimension-picker-mousecatcher');
      $catcher.css({
        width: options.insertTableMaxSize.col + 'em',
        height: options.insertTableMaxSize.row + 'em'
      }).on('mousemove', function (event) {
        hDimensionPickerMove(event, options);
      });

      // save options on editor
      layoutInfo.editor.data('options', options);

      // ret styleWithCSS for backColor / foreColor clearing with 'inherit'.
      if (!agent.isMSIE) {
        // protect FF Error: NS_ERROR_FAILURE: Failure
        setTimeout(function () {
          document.execCommand('styleWithCSS', 0, options.styleWithSpan);
        }, 0);
      }

      // History
      var history = new History(layoutInfo.editable);
      layoutInfo.editable.data('NoteHistory', history);

      // basic event callbacks (lowercase)
      // enter, focus, blur, keyup, keydown
      if (options.onenter) {
        layoutInfo.editable.keypress(function (event) {
          if (event.keyCode === key.ENTER) { options.onenter(event); }
        });
      }

      if (options.onfocus) { layoutInfo.editable.focus(options.onfocus); }
      if (options.onblur) { layoutInfo.editable.blur(options.onblur); }
      if (options.onkeyup) { layoutInfo.editable.keyup(options.onkeyup); }
      if (options.onkeydown) { layoutInfo.editable.keydown(options.onkeydown); }
      if (options.onpaste) { layoutInfo.editable.on('paste', options.onpaste); }

      // callbacks for advanced features (camel)
      if (options.onToolbarClick) { layoutInfo.toolbar.click(options.onToolbarClick); }
      if (options.onChange) {
        var hChange = function () {
          editor.triggerOnChange(layoutInfo.editable);
        };

        if (agent.isMSIE) {
          var sDomEvents = 'DOMCharacterDataModified DOMSubtreeModified DOMNodeInserted';
          layoutInfo.editable.on(sDomEvents, hChange);
        } else {
          layoutInfo.editable.on('input', hChange);
        }
      }

      // All editor status will be saved on editable with jquery's data
      // for support multiple editor with singleton object.
      layoutInfo.editable.data('callbacks', {
        onBeforeChange: options.onBeforeChange,
        onChange: options.onChange,
        onAutoSave: options.onAutoSave,
        onImageUpload: options.onImageUpload,
        onImageUploadError: options.onImageUploadError,
        onFileUpload: options.onFileUpload,
        onFileUploadError: options.onFileUpload,
        onMediaDelete : options.onMediaDelete
      });
    };

    this.detach = function (layoutInfo, options) {
      layoutInfo.editable.off();

      layoutInfo.popover.off();
      layoutInfo.handle.off();
      layoutInfo.dialog.off();

      if (!options.airMode) {
        layoutInfo.dropzone.off();
        layoutInfo.toolbar.off();
        layoutInfo.statusbar.off();
      }
    };
  };

  /**
   * @class Renderer
   *
   * renderer
   *
   * rendering toolbar and editable
   */
  var Renderer = function () {

    /**
     * bootstrap button template
     * @private
     * @param {String} label button name
     * @param {Object} [options] button options
     * @param {String} [options.event] data-event
     * @param {String} [options.className] button's class name
     * @param {String} [options.value] data-value
     * @param {String} [options.title] button's title for popup
     * @param {String} [options.dropdown] dropdown html
     * @param {String} [options.hide] data-hide
     */
    var tplButton = function (label, options) {
      var event = options.event;
      var value = options.value;
      var title = options.title;
      var className = options.className;
      var dropdown = options.dropdown;
      var hide = options.hide;

      return '<button type="button"' +
                 ' class="btn btn-default btn-sm btn-small' +
                   (className ? ' ' + className : '') +
                   (dropdown ? ' dropdown-toggle' : '') +
                 '"' +
                 (dropdown ? ' data-toggle="dropdown"' : '') +
                 (title ? ' title="' + title + '"' : '') +
                 (event ? ' data-event="' + event + '"' : '') +
                 (value ? ' data-value=\'' + value + '\'' : '') +
                 (hide ? ' data-hide=\'' + hide + '\'' : '') +
                 ' tabindex="-1">' +
               label +
               (dropdown ? ' <span class="caret"></span>' : '') +
             '</button>' +
             (dropdown || '');
    };

    /**
     * bootstrap icon button template
     * @private
     * @param {String} iconClassName
     * @param {Object} [options]
     * @param {String} [options.event]
     * @param {String} [options.value]
     * @param {String} [options.title]
     * @param {String} [options.dropdown]
     */
    var tplIconButton = function (iconClassName, options) {
      var label = '<i class="' + iconClassName + '"></i>';
      return tplButton(label, options);
    };

    /**
     * bootstrap popover template
     * @private
     * @param {String} className
     * @param {String} content
     */
    var tplPopover = function (className, content) {
      return '<div class="' + className + ' popover bottom in" style="display: none;">' +
               '<div class="arrow"></div>' +
               '<div class="popover-content">' +
                 content +
               '</div>' +
             '</div>';
    };

    /**
     * bootstrap dialog template
     *
     * @param {String} className
     * @param {String} [title='']
     * @param {String} body
     * @param {String} [footer='']
     */
    var tplDialog = function (className, title, body, footer) {
      return '<div class="' + className + ' modal" aria-hidden="false">' +
               '<div class="modal-dialog">' +
                 '<div class="modal-content">' +
                   (title ?
                   '<div class="modal-header">' +
                     '<button type="button" class="close" aria-hidden="true" tabindex="-1">&times;</button>' +
                     '<h4 class="modal-title">' + title + '</h4>' +
                   '</div>' : ''
                   ) +
                   '<form class="note-modal-form">' +
                     '<div class="modal-body">' + body + '</div>' +
                     (footer ?
                     '<div class="modal-footer">' + footer + '</div>' : ''
                     ) +
                   '</form>' +
                 '</div>' +
               '</div>' +
             '</div>';
    };

    var tplButtonInfo = {
      picture: function (lang) {
        return tplIconButton('fa fa-picture-o', {
          event: 'showImageDialog',
          title: lang.image.image,
          hide: true
        });
      },
      link: function (lang) {
        return tplIconButton('fa fa-link', {
          event: 'showLinkDialog',
          title: lang.link.link,
          hide: true
        });
      },
      table: function (lang) {
        var dropdown = '<ul class="note-table dropdown-menu">' +
                         '<div class="note-dimension-picker">' +
                           '<div class="note-dimension-picker-mousecatcher" data-event="insertTable" data-value="1x1"></div>' +
                           '<div class="note-dimension-picker-highlighted"></div>' +
                           '<div class="note-dimension-picker-unhighlighted"></div>' +
                         '</div>' +
                         '<div class="note-dimension-display"> 1 x 1 </div>' +
                       '</ul>';
        return tplIconButton('fa fa-table', {
          title: lang.table.table,
          dropdown: dropdown
        });
      },
      style: function (lang, options) {
        var items = options.styleTags.reduce(function (memo, v) {
          var label = lang.style[v === 'p' ? 'normal' : v];
          return memo + '<li><a data-event="formatBlock" href="#" data-value="' + v + '">' +
                   (
                     (v === 'p' || v === 'pre') ? label :
                     '<' + v + '>' + label + '</' + v + '>'
                   ) +
                 '</a></li>';
        }, '');

        return tplIconButton('fa fa-magic', {
          title: lang.style.style,
          dropdown: '<ul class="dropdown-menu">' + items + '</ul>'
        });
      },
      fontname: function (lang, options) {
        var items = options.fontNames.reduce(function (memo, v) {
          if (!agent.isFontInstalled(v) && options.fontNamesIgnoreCheck.indexOf(v) === -1) {
            return memo;
          }
          return memo + '<li><a data-event="fontName" href="#" data-value="' + v + '" style="font-family:\'' + v + '\'">' +
                          '<i class="fa fa-check"></i> ' + v +
                        '</a></li>';
        }, '');
        var label = '<span class="note-current-fontname">' +
                       options.defaultFontName +
                     '</span>';
        return tplButton(label, {
          title: lang.font.name,
          dropdown: '<ul class="dropdown-menu">' + items + '</ul>'
        });
      },
      color: function (lang) {
        var colorButtonLabel = '<i class="fa fa-font" style="color:black;background-color:yellow;"></i>';
        var colorButton = tplButton(colorButtonLabel, {
          className: 'note-recent-color',
          title: lang.color.recent,
          event: 'color',
          value: '{"backColor":"yellow"}'
        });

        var dropdown = '<ul class="dropdown-menu">' +
                         '<li>' +
                           '<div class="btn-group">' +
                             '<div class="note-palette-title">' + lang.color.background + '</div>' +
                             '<div class="note-color-reset" data-event="backColor"' +
                               ' data-value="inherit" title="' + lang.color.transparent + '">' +
                               lang.color.setTransparent +
                             '</div>' +
                             '<div class="note-color-palette" data-target-event="backColor"></div>' +
                           '</div>' +
                           '<div class="btn-group">' +
                             '<div class="note-palette-title">' + lang.color.foreground + '</div>' +
                             '<div class="note-color-reset" data-event="foreColor" data-value="inherit" title="' + lang.color.reset + '">' +
                               lang.color.resetToDefault +
                             '</div>' +
                             '<div class="note-color-palette" data-target-event="foreColor"></div>' +
                           '</div>' +
                         '</li>' +
                       '</ul>';

        var moreButton = tplButton('', {
          title: lang.color.more,
          dropdown: dropdown
        });

        return colorButton + moreButton;
      },
      bold: function (lang) {
        return tplIconButton('fa fa-bold', {
          event: 'bold',
          title: lang.font.bold
        });
      },
      italic: function (lang) {
        return tplIconButton('fa fa-italic', {
          event: 'italic',
          title: lang.font.italic
        });
      },
      underline: function (lang) {
        return tplIconButton('fa fa-underline', {
          event: 'underline',
          title: lang.font.underline
        });
      },
      clear: function (lang) {
        return tplIconButton('fa fa-eraser', {
          event: 'removeFormat',
          title: lang.font.clear
        });
      },
      ul: function (lang) {
        return tplIconButton('fa fa-list-ul', {
          event: 'insertUnorderedList',
          title: lang.lists.unordered
        });
      },
      ol: function (lang) {
        return tplIconButton('fa fa-list-ol', {
          event: 'insertOrderedList',
          title: lang.lists.ordered
        });
      },
      paragraph: function (lang) {
        var leftButton = tplIconButton('fa fa-align-left', {
          title: lang.paragraph.left,
          event: 'justifyLeft'
        });
        var centerButton = tplIconButton('fa fa-align-center', {
          title: lang.paragraph.center,
          event: 'justifyCenter'
        });
        var rightButton = tplIconButton('fa fa-align-right', {
          title: lang.paragraph.right,
          event: 'justifyRight'
        });
        var justifyButton = tplIconButton('fa fa-align-justify', {
          title: lang.paragraph.justify,
          event: 'justifyFull'
        });

        var outdentButton = tplIconButton('fa fa-outdent', {
          title: lang.paragraph.outdent,
          event: 'outdent'
        });
        var indentButton = tplIconButton('fa fa-indent', {
          title: lang.paragraph.indent,
          event: 'indent'
        });

        var dropdown = '<div class="dropdown-menu">' +
                         '<div class="note-align btn-group">' +
                           leftButton + centerButton + rightButton + justifyButton +
                         '</div>' +
                         '<div class="note-list btn-group">' +
                           indentButton + outdentButton +
                         '</div>' +
                       '</div>';

        return tplIconButton('fa fa-align-left', {
          title: lang.paragraph.paragraph,
          dropdown: dropdown
        });
      },
      height: function (lang, options) {
        var items = options.lineHeights.reduce(function (memo, v) {
          return memo + '<li><a data-event="lineHeight" href="#" data-value="' + parseFloat(v) + '">' +
                          '<i class="fa fa-check"></i> ' + v +
                        '</a></li>';
        }, '');

        return tplIconButton('fa fa-text-height', {
          title: lang.font.height,
          dropdown: '<ul class="dropdown-menu">' + items + '</ul>'
        });

      },
      help: function (lang) {
        return tplIconButton('fa fa-question', {
          event: 'showHelpDialog',
          title: lang.options.help,
          hide: true
        });
      },
      fullscreen: function (lang) {
        return tplIconButton('fa fa-arrows-alt', {
          event: 'fullscreen',
          title: lang.options.fullscreen
        });
      },
      codeview: function (lang) {
        return tplIconButton('fa fa-code', {
          event: 'codeview',
          title: lang.options.codeview
        });
      },
      undo: function (lang) {
        return tplIconButton('fa fa-undo', {
          event: 'undo',
          title: lang.history.undo
        });
      },
      redo: function (lang) {
        return tplIconButton('fa fa-repeat', {
          event: 'redo',
          title: lang.history.redo
        });
      },
      hr: function (lang) {
        return tplIconButton('fa fa-minus', {
          event: 'insertHorizontalRule',
          title: lang.hr.insert
        });
      }
    };

    var tplPopovers = function (lang, options) {
      var tplLinkPopover = function () {
        var linkButton = tplIconButton('fa fa-edit', {
          title: lang.link.edit,
          event: 'showLinkDialog',
          hide: true
        });
        var unlinkButton = tplIconButton('fa fa-unlink', {
          title: lang.link.unlink,
          event: 'unlink'
        });
        var content = '<a href="http://www.google.com" target="_blank">www.google.com</a>&nbsp;&nbsp;' +
                      '<div class="note-insert btn-group">' +
                        linkButton + unlinkButton +
                      '</div>';
        return tplPopover('note-link-popover', content);
      };

      var tplImagePopover = function () {
        var fullButton = tplButton('<span class="note-fontsize-10">100%</span>', {
          title: lang.image.resizeFull,
          event: 'resize',
          value: '1'
        });
        var halfButton = tplButton('<span class="note-fontsize-10">50%</span>', {
          title: lang.image.resizeHalf,
          event: 'resize',
          value: '0.5'
        });
        var quarterButton = tplButton('<span class="note-fontsize-10">25%</span>', {
          title: lang.image.resizeQuarter,
          event: 'resize',
          value: '0.25'
        });

        var leftButton = tplIconButton('fa fa-align-left', {
          title: lang.image.floatLeft,
          event: 'floatMe',
          value: 'left'
        });
        var rightButton = tplIconButton('fa fa-align-right', {
          title: lang.image.floatRight,
          event: 'floatMe',
          value: 'right'
        });
        var justifyButton = tplIconButton('fa fa-align-justify', {
          title: lang.image.floatNone,
          event: 'floatMe',
          value: 'none'
        });

        var roundedButton = tplIconButton('fa fa-square', {
          title: lang.image.shapeRounded,
          event: 'imageShape',
          value: 'img-rounded'
        });
        var circleButton = tplIconButton('fa fa-circle-o', {
          title: lang.image.shapeCircle,
          event: 'imageShape',
          value: 'img-circle'
        });
        var thumbnailButton = tplIconButton('fa fa-picture-o', {
          title: lang.image.shapeThumbnail,
          event: 'imageShape',
          value: 'img-thumbnail'
        });
        var noneButton = tplIconButton('fa fa-times', {
          title: lang.image.shapeNone,
          event: 'imageShape',
          value: ''
        });

        var removeButton = tplIconButton('fa fa-trash-o', {
          title: lang.image.remove,
          event: 'removeMedia',
          value: 'none'
        });

        var content = '<div class="btn-group">' + fullButton + halfButton + quarterButton + '</div>' +
                      '<div class="btn-group">' + leftButton + rightButton + justifyButton + '</div>' +
                      '<div class="btn-group">' + roundedButton + circleButton + thumbnailButton + noneButton + '</div>' +
                      '<div class="btn-group">' + removeButton + '</div>';
        return tplPopover('note-image-popover', content);
      };

      var tplAirPopover = function () {
        var content = '';
        for (var idx = 0, len = options.airPopover.length; idx < len; idx ++) {
          var group = options.airPopover[idx];
          content += '<div class="note-' + group[0] + ' btn-group">';
          for (var i = 0, lenGroup = group[1].length; i < lenGroup; i++) {
            content += tplButtonInfo[group[1][i]](lang, options);
          }
          content += '</div>';
        }

        return tplPopover('note-air-popover', content);
      };

      return '<div class="note-popover">' +
               tplLinkPopover() +
               tplImagePopover() +
               (options.airMode ?  tplAirPopover() : '') +
             '</div>';
    };

    var tplHandles = function () {
      return '<div class="note-handle">' +
               '<div class="note-control-selection">' +
                 '<div class="note-control-selection-bg"></div>' +
                 '<div class="note-control-holder note-control-nw"></div>' +
                 '<div class="note-control-holder note-control-ne"></div>' +
                 '<div class="note-control-holder note-control-sw"></div>' +
                 '<div class="note-control-sizing note-control-se"></div>' +
                 '<div class="note-control-selection-info"></div>' +
               '</div>' +
             '</div>';
    };

    /**
     * shortcut table template
     * @param {String} title
     * @param {String} body
     */
    var tplShortcut = function (title, keys) {
      var keyClass = 'note-shortcut-col col-xs-6 note-shortcut-';
      var body = [];

      for (var i in keys) {
        if (keys.hasOwnProperty(i)) {
          body.push(
            '<div class="' + keyClass + 'key">' + keys[i].kbd + '</div>' +
            '<div class="' + keyClass + 'name">' + keys[i].text + '</div>'
            );
        }
      }

      return '<div class="note-shortcut-row row"><div class="' + keyClass + 'title col-xs-offset-6">' + title + '</div></div>' +
             '<div class="note-shortcut-row row">' + body.join('</div><div class="note-shortcut-row row">') + '</div>';
    };

    var tplShortcutText = function (lang) {
      var keys = [
        { kbd: '⌘ + B', text: lang.font.bold },
        { kbd: '⌘ + I', text: lang.font.italic },
        { kbd: '⌘ + U', text: lang.font.underline },
        { kbd: '⌘ + \\', text: lang.font.clear }
      ];

      return tplShortcut(lang.shortcut.textFormatting, keys);
    };

    var tplShortcutAction = function (lang) {
      var keys = [
        { kbd: '⌘ + Z', text: lang.history.undo },
        { kbd: '⌘ + ⇧ + Z', text: lang.history.redo },
        { kbd: '⌘ + ]', text: lang.paragraph.indent },
        { kbd: '⌘ + [', text: lang.paragraph.outdent },
        { kbd: '⌘ + ENTER', text: lang.hr.insert }
      ];

      return tplShortcut(lang.shortcut.action, keys);
    };

    var tplShortcutPara = function (lang) {
      var keys = [
        { kbd: '⌘ + ⇧ + L', text: lang.paragraph.left },
        { kbd: '⌘ + ⇧ + E', text: lang.paragraph.center },
        { kbd: '⌘ + ⇧ + R', text: lang.paragraph.right },
        { kbd: '⌘ + ⇧ + J', text: lang.paragraph.justify },
        { kbd: '⌘ + ⇧ + NUM7', text: lang.lists.ordered },
        { kbd: '⌘ + ⇧ + NUM8', text: lang.lists.unordered }
      ];

      return tplShortcut(lang.shortcut.paragraphFormatting, keys);
    };

    var tplShortcutStyle = function (lang) {
      var keys = [
        { kbd: '⌘ + NUM0', text: lang.style.normal },
        { kbd: '⌘ + NUM1', text: lang.style.h1 },
        { kbd: '⌘ + NUM2', text: lang.style.h2 },
        { kbd: '⌘ + NUM3', text: lang.style.h3 },
        { kbd: '⌘ + NUM4', text: lang.style.h4 },
        { kbd: '⌘ + NUM5', text: lang.style.h5 },
        { kbd: '⌘ + NUM6', text: lang.style.h6 }
      ];

      return tplShortcut(lang.shortcut.documentStyle, keys);
    };

    var tplExtraShortcuts = function (lang, options) {
      var extraKeys = options.extraKeys;
      var keys = [];

      for (var key in extraKeys) {
        if (extraKeys.hasOwnProperty(key)) {
          keys.push({ kbd: key, text: extraKeys[key] });
        }
      }

      return tplShortcut(lang.shortcut.extraKeys, keys);
    };

    var tplShortcutTable = function (lang, options) {
      var colClass = 'class="note-shortcut note-shortcut-col col-sm-6 col-xs-12"';
      var template = [
        '<div ' + colClass + '>' + tplShortcutAction(lang, options) + '</div>' +
        '<div ' + colClass + '>' + tplShortcutText(lang, options) + '</div>',
        '<div ' + colClass + '>' + tplShortcutStyle(lang, options) + '</div>' +
        '<div ' + colClass + '>' + tplShortcutPara(lang, options) + '</div>'
      ];

      if (options.extraKeys) {
        template.push('<div ' + colClass + '>' + tplExtraShortcuts(lang, options) + '</div>');
      }

      return '<div class="note-shortcut-row row">' +
               template.join('</div><div class="note-shortcut-row row">') +
             '</div>';
    };

    var replaceMacKeys = function (sHtml) {
      return sHtml.replace(/⌘/g, 'Ctrl').replace(/⇧/g, 'Shift');
    };

    var tplDialogInfo = {
      image: function (lang, options) {
        var imageLimitation = '';
        if (options.maximumImageFileSize) {
          var unit = Math.floor(Math.log(options.maximumImageFileSize) / Math.log(1024));
          var readableSize = (options.maximumImageFileSize / Math.pow(1024, unit)).toFixed(2) * 1 +
                             ' ' + ' KMGTP'[unit] + 'B';
          imageLimitation = '<small>' + lang.image.maximumFileSize + ' : ' + readableSize + '</small>';
        }

        var body = '<div class="form-group row-fluid note-group-select-from-files">' +
                     '<label>' + lang.image.selectFromFiles + '</label>' +
                     '<input class="note-image-input" type="file" name="files" accept="image/*" multiple="multiple" />' +
                     imageLimitation +
                   '</div>' +
                   '<div class="form-group row-fluid">' +
                     '<label>' + lang.image.url + '</label>' +
                     '<input class="note-image-url form-control span12" type="text" />' +
                   '</div>';
        var footer = '<button href="#" class="btn btn-primary note-image-btn disabled" disabled>' + lang.image.insert + '</button>';
        return tplDialog('note-image-dialog', lang.image.insert, body, footer);
      },

      link: function (lang, options) {
        var body = '<div class="form-group row-fluid">' +
                     '<label>' + lang.link.textToDisplay + '</label>' +
                     '<input class="note-link-text form-control span12" type="text" />' +
                   '</div>' +
                   '<div class="form-group row-fluid">' +
                     '<label>' + lang.link.url + '</label>' +
                     '<input class="note-link-url form-control span12" type="text" />' +
                   '</div>' +
                   (!options.disableLinkTarget ?
                     '<div class="checkbox">' +
                       '<label>' + '<input type="checkbox" checked> ' +
                         lang.link.openInNewWindow +
                       '</label>' +
                     '</div>' : ''
                   );
        var footer = '<button href="#" class="btn btn-primary note-link-btn disabled" disabled>' + lang.link.insert + '</button>';
        return tplDialog('note-link-dialog', lang.link.insert, body, footer);
      },

      help: function (lang, options) {
        var body = '<a class="modal-close pull-right" aria-hidden="true" tabindex="-1">' + lang.shortcut.close + '</a>' +
                   '<div class="title">' + lang.shortcut.shortcuts + '</div>' +
                   (agent.isMac ? tplShortcutTable(lang, options) : replaceMacKeys(tplShortcutTable(lang, options))) +
                   '<p class="text-center">' +
                     '<a href="//summernote.org/" target="_blank">Summernote 0.6.1</a> · ' +
                     '<a href="//github.com/summernote/summernote" target="_blank">Project</a> · ' +
                     '<a href="//github.com/summernote/summernote/issues" target="_blank">Issues</a>' +
                   '</p>';
        return tplDialog('note-help-dialog', '', body, '');
      }
    };

    var tplDialogs = function (lang, options) {
      var dialogs = '';

      $.each(tplDialogInfo, function (idx, tplDialog) {
        dialogs += tplDialog(lang, options);
      });

      return '<div class="note-dialog">' + dialogs + '</div>';
    };

    var tplStatusbar = function () {
      return '<div class="note-resizebar">' +
               '<div class="note-icon-bar"></div>' +
               '<div class="note-icon-bar"></div>' +
               '<div class="note-icon-bar"></div>' +
             '</div>';
    };

    var representShortcut = function (str) {
      if (agent.isMac) {
        str = str.replace('CMD', '⌘').replace('SHIFT', '⇧');
      }

      return str.replace('BACKSLASH', '\\')
                .replace('SLASH', '/')
                .replace('LEFTBRACKET', '[')
                .replace('RIGHTBRACKET', ']');
    };

    /**
     * createTooltip
     *
     * @param {jQuery} $container
     * @param {Object} keyMap
     * @param {String} [sPlacement]
     */
    var createTooltip = function ($container, keyMap, sPlacement) {
      var invertedKeyMap = func.invertObject(keyMap);
      var $buttons = $container.find('button');

      $buttons.each(function (i, elBtn) {
        var $btn = $(elBtn);
        var sShortcut = invertedKeyMap[$btn.data('event')];
        if (sShortcut) {
          $btn.attr('title', function (i, v) {
            return v + ' (' + representShortcut(sShortcut) + ')';
          });
        }
      // bootstrap tooltip on btn-group bug
      // https://github.com/twbs/bootstrap/issues/5687
      }).tooltip({
        container: 'body',
        trigger: 'hover',
        placement: sPlacement || 'top'
      }).on('click', function () {
        $(this).tooltip('hide');
      });
    };

    // createPalette
    var createPalette = function ($container, options) {
      var colorInfo = options.colors;
      $container.find('.note-color-palette').each(function () {
        var $palette = $(this), eventName = $palette.attr('data-target-event');
        var paletteContents = [];
        for (var row = 0, lenRow = colorInfo.length; row < lenRow; row++) {
          var colors = colorInfo[row];
          var buttons = [];
          for (var col = 0, lenCol = colors.length; col < lenCol; col++) {
            var color = colors[col];
            buttons.push(['<button type="button" class="note-color-btn" style="background-color:', color,
                           ';" data-event="', eventName,
                           '" data-value="', color,
                           '" title="', color,
                           '" data-toggle="button" tabindex="-1"></button>'].join(''));
          }
          paletteContents.push('<div class="note-color-row">' + buttons.join('') + '</div>');
        }
        $palette.html(paletteContents.join(''));
      });
    };

    /**
     * create summernote layout (air mode)
     *
     * @param {jQuery} $holder
     * @param {Object} options
     */
    this.createLayoutByAirMode = function ($holder, options) {
      var langInfo = options.langInfo;
      var keyMap = options.keyMap[agent.isMac ? 'mac' : 'pc'];
      var id = func.uniqueId();

      $holder.addClass('note-air-editor note-editable');
      $holder.attr({
        'id': 'note-editor-' + id,
        'contentEditable': true
      });

      var body = document.body;

      // create Popover
      var $popover = $(tplPopovers(langInfo, options));
      $popover.addClass('note-air-layout');
      $popover.attr('id', 'note-popover-' + id);
      $popover.appendTo(body);
      createTooltip($popover, keyMap);
      createPalette($popover, options);

      // create Handle
      var $handle = $(tplHandles());
      $handle.addClass('note-air-layout');
      $handle.attr('id', 'note-handle-' + id);
      $handle.appendTo(body);

      // create Dialog
      var $dialog = $(tplDialogs(langInfo, options));
      $dialog.addClass('note-air-layout');
      $dialog.attr('id', 'note-dialog-' + id);
      $dialog.find('button.close, a.modal-close').click(function () {
        $(this).closest('.modal').modal('hide');
      });
      $dialog.appendTo(body);
    };

    /**
     * create summernote layout (normal mode)
     *
     * @param {jQuery} $holder
     * @param {Object} options
     */
    this.createLayoutByFrame = function ($holder, options) {
      var langInfo = options.langInfo;

      //01. create Editor
      var $editor = $('<div class="note-editor"></div>');
      if (options.width) {
        $editor.width(options.width);
      }

      //02. statusbar (resizebar)
      if (options.height > 0) {
        $('<div class="note-statusbar">' + (options.disableResizeEditor ? '' : tplStatusbar()) + '</div>').prependTo($editor);
      }

      //03. create Editable
      var isContentEditable = !$holder.is(':disabled');
      var $editable = $('<div class="note-editable" contentEditable="' + isContentEditable + '"></div>')
          .prependTo($editor);
      if (options.height) {
        $editable.height(options.height);
      }
      if (options.direction) {
        $editable.attr('dir', options.direction);
      }
      var placeholder = $holder.attr('placeholder') || options.placeholder;
      if (placeholder) {
        $editable.attr('data-placeholder', placeholder);
      }

      $editable.html(dom.html($holder));

      //031. create codable
      $('<textarea class="note-codable"></textarea>').prependTo($editor);

      //04. create Toolbar
      var toolbarHTML = '';
      for (var idx = 0, len = options.toolbar.length; idx < len; idx ++) {
        var groupName = options.toolbar[idx][0];
        var groupButtons = options.toolbar[idx][1];

        toolbarHTML += '<div class="note-' + groupName + ' btn-group">';
        for (var i = 0, btnLength = groupButtons.length; i < btnLength; i++) {
          var buttonInfo = tplButtonInfo[groupButtons[i]];
          // continue creating toolbar even if a button doesn't exist
          if (!$.isFunction(buttonInfo)) { continue; }
          toolbarHTML += buttonInfo(langInfo, options);
        }
        toolbarHTML += '</div>';
      }

      toolbarHTML = '<div class="note-toolbar btn-toolbar">' + toolbarHTML + '</div>';

      var $toolbar = $(toolbarHTML).prependTo($editor);
      var keyMap = options.keyMap[agent.isMac ? 'mac' : 'pc'];
      createPalette($toolbar, options);
      createTooltip($toolbar, keyMap, 'bottom');

      //05. create Popover
      var $popover = $(tplPopovers(langInfo, options)).prependTo($editor);
      createPalette($popover, options);
      createTooltip($popover, keyMap);

      //06. handle(control selection, ...)
      $(tplHandles()).prependTo($editor);

      //07. create Dialog
      var $dialog = $(tplDialogs(langInfo, options)).prependTo($editor);
      $dialog.find('button.close, a.modal-close').click(function () {
        $(this).closest('.modal').modal('hide');
      });

      //08. create Dropzone
      $('<div class="note-dropzone"><div class="note-dropzone-message"></div></div>').prependTo($editor);

      //09. Editor/Holder switch
      $editor.insertAfter($holder);
      $holder.hide();
    };

    this.noteEditorFromHolder = function ($holder) {
      if ($holder.hasClass('note-air-editor')) {
        return $holder;
      } else if ($holder.next().hasClass('note-editor')) {
        return $holder.next();
      } else {
        return $();
      }
    };

    /**
     * create summernote layout
     *
     * @param {jQuery} $holder
     * @param {Object} options
     */
    this.createLayout = function ($holder, options) {
      if (this.noteEditorFromHolder($holder).length) {
        return;
      }

      if (options.airMode) {
        this.createLayoutByAirMode($holder, options);
      } else {
        this.createLayoutByFrame($holder, options);
      }
    };

    /**
     * returns layoutInfo from holder
     *
     * @param {jQuery} $holder - placeholder
     * @returns {Object}
     */
    this.layoutInfoFromHolder = function ($holder) {
      var $editor = this.noteEditorFromHolder($holder);
      if (!$editor.length) { return; }

      var layoutInfo = dom.buildLayoutInfo($editor);
      // cache all properties.
      for (var key in layoutInfo) {
        if (layoutInfo.hasOwnProperty(key)) {
          layoutInfo[key] = layoutInfo[key].call();
        }
      }
      return layoutInfo;
    };

    /**
     * removeLayout
     *
     * @param {jQuery} $holder - placeholder
     * @param {Object} layoutInfo
     * @param {Object} options
     *
     */
    this.removeLayout = function ($holder, layoutInfo, options) {
      if (options.airMode) {
        $holder.removeClass('note-air-editor note-editable')
               .removeAttr('id contentEditable');

        layoutInfo.popover.remove();
        layoutInfo.handle.remove();
        layoutInfo.dialog.remove();
      } else {
        $holder.html(layoutInfo.editable.html());

        layoutInfo.editor.remove();
        $holder.show();
      }
    };

    /**
     *
     * @return {Object}
     * @return {function(label, options=):string} return.button {@link #tplButton function to make text button}
     * @return {function(iconClass, options=):string} return.iconButton {@link #tplIconButton function to make icon button}
     * @return {function(className, title=, body=, footer=):string} return.dialog {@link #tplDialog function to make dialog}
     */
    this.getTemplate = function () {
      return {
        button: tplButton,
        iconButton: tplIconButton,
        dialog: tplDialog
      };
    };

    /**
     * add button information
     *
     * @param {String} name button name
     * @param {Function} buttonInfo function to make button, reference to {@link #tplButton},{@link #tplIconButton}
     */
    this.addButtonInfo = function (name, buttonInfo) {
      tplButtonInfo[name] = buttonInfo;
    };

    /**
     *
     * @param {String} name
     * @param {Function} dialogInfo function to make dialog, reference to {@link #tplDialog}
     */
    this.addDialogInfo = function (name, dialogInfo) {
      tplDialogInfo[name] = dialogInfo;
    };
  };


  // jQuery namespace for summernote
  /**
   * @class $.summernote 
   * 
   * summernote attribute  
   * 
   * @mixin settings
   * @singleton  
   * 
   */
  $.summernote = $.summernote || {};

  // extends default `settings`
  $.extend($.summernote, settings);

  var renderer = new Renderer();
  var eventHandler = new EventHandler();

  $.extend($.summernote, {
    /** @property {Renderer} */
    renderer: renderer,
    /** @property {EventHandler} */
    eventHandler: eventHandler,
    /** 
     * @property {Object} core 
     * @property {core.agent} core.agent 
     * @property {core.dom} core.dom
     * @property {core.range} core.range 
     */
    core: {
      agent: agent,
      dom: dom,
      range: range
    },
    /** 
     * @property {Object} 
     * pluginEvents event list for plugins
     * event has name and callback function.
     * 
     * ``` 
     * $.summernote.addPlugin({
     *     events : {
     *          'hello' : function(layoutInfo, value, $target) {
     *              console.log('event name is hello, value is ' + value );
     *          }
     *     }     
     * })
     * ```
     * 
     * * event name is data-event property.
     * * layoutInfo is a summernote layout information.
     * * value is data-value property.
     */
    pluginEvents: {}
  });

  /**
   * @method addPlugin
   *
   * add Plugin in Summernote 
   * 
   * Summernote can make a own plugin.
   *
   * ### Define plugin
   * ```
   * // get template function  
   * var tmpl = $.summernote.renderer.getTemplate();
   * 
   * // add a button   
   * $.summernote.addPlugin({
   *     buttons : {
   *        // "hello"  is button's namespace.      
   *        "hello" : function(lang, options) {
   *            // make icon button by template function          
   *            return tmpl.iconButton('fa fa-header', {
   *                // callback function name when button clicked 
   *                event : 'hello',
   *                // set data-value property                 
   *                value : 'hello',                
   *                hide : true
   *            });           
   *        }
   *     
   *     }, 
   *     
   *     events : {
   *        "hello" : function(layoutInfo, value) {
   *            // here is event code 
   *        }
   *     }     
   * });
   * ``` 
   * ### Use a plugin in toolbar
   * 
   * ``` 
   *    $("#editor").summernote({
   *    ...
   *    toolbar : [
   *        // display hello plugin in toolbar     
   *        ['group', [ 'hello' ]]
   *    ]
   *    ...    
   *    });
   * ```
   *  
   *  
   * @param {Object} plugin
   * @param {Object} [plugin.buttons] define plugin button. for detail, see to Renderer.addButtonInfo
   * @param {Object} [plugin.dialogs] define plugin dialog. for detail, see to Renderer.addDialogInfo
   * @param {Object} [plugin.events] add event in $.summernote.pluginEvents 
   * @param {Object} [plugin.langs] update $.summernote.lang
   * @param {Object} [plugin.options] update $.summernote.options
   */
  $.summernote.addPlugin = function (plugin) {
    if (plugin.buttons) {
      $.each(plugin.buttons, function (name, button) {
        renderer.addButtonInfo(name, button);
      });
    }

    if (plugin.dialogs) {
      $.each(plugin.dialogs, function (name, dialog) {
        renderer.addDialogInfo(name, dialog);
      });
    }

    if (plugin.events) {
      $.each(plugin.events, function (name, event) {
        $.summernote.pluginEvents[name] = event;
      });
    }

    if (plugin.langs) {
      $.each(plugin.langs, function (locale, lang) {
        if ($.summernote.lang[locale]) {
          $.extend($.summernote.lang[locale], lang);
        }
      });
    }

    if (plugin.options) {
      $.extend($.summernote.options, plugin.options);
    }
  };

  /*
   * extend $.fn
   */
  $.fn.extend({
    /**
     * @method
     * Initialize summernote
     *  - create editor layout and attach Mouse and keyboard events.
     * 
     * ```
     * $("#summernote").summernote( { options ..} );
     * ```
     *   
     * @member $.fn
     * @param {Object} options reference to $.summernote.options
     * @returns {this}
     */
    summernote: function (options) {
      // extend default options
      options = $.extend({}, $.summernote.options, options);

      // Include langInfo in options for later use, e.g. for image drag-n-drop
      // Setup language info with en-US as default
      options.langInfo = $.extend(true, {}, $.summernote.lang['en-US'], $.summernote.lang[options.lang]);

      this.each(function (idx, holder) {
        var $holder = $(holder);

        // createLayout with options
        renderer.createLayout($holder, options);

        var info = renderer.layoutInfoFromHolder($holder);
        eventHandler.attach(info, options);

        // Textarea: auto filling the code before form submit.
        if (dom.isTextarea($holder[0])) {
          $holder.closest('form').submit(function () {
            var contents = $holder.code();
            $holder.val(contents);

            // callback on submit
            if (options.onsubmit) {
              options.onsubmit(contents);
            }
          });
        }
      });

      // focus on first editable element
      if (this.first().length && options.focus) {
        var info = renderer.layoutInfoFromHolder(this.first());
        info.editable.focus();
      }

      // callback on init
      if (this.length && options.oninit) {
        options.oninit();
      }

      return this;
    },
    //

    /**
     * @method 
     * 
     * get the HTML contents of note or set the HTML contents of note.
     *
     * * get contents 
     * ```
     * var content = $("#summernote").code();
     * ```
     * * set contents 
     *
     * ```
     * $("#summernote").code(html);
     * ```
     *
     * @member $.fn 
     * @param {String} [sHTML] - HTML contents(optional, set)
     * @returns {this|String} - context(set) or HTML contents of note(get).
     */
    code: function (sHTML) {
      // get the HTML contents of note
      if (sHTML === undefined) {
        var $holder = this.first();
        if (!$holder.length) { return; }
        var info = renderer.layoutInfoFromHolder($holder);
        if (!!(info && info.editable)) {
          var isCodeview = info.editor.hasClass('codeview');
          if (isCodeview && agent.hasCodeMirror) {
            info.codable.data('cmEditor').save();
          }
          return isCodeview ? info.codable.val() : info.editable.html();
        }
        return dom.isTextarea($holder[0]) ? $holder.val() : $holder.html();
      }

      // set the HTML contents of note
      this.each(function (i, holder) {
        var info = renderer.layoutInfoFromHolder($(holder));
        if (info && info.editable) { info.editable.html(sHTML); }
      });

      return this;
    },

    /**
     * @method
     * 
     * destroy Editor Layout and detach Key and Mouse Event
     *
     * @member $.fn
     * @returns {this}
     */
    destroy: function () {
      this.each(function (idx, holder) {
        var $holder = $(holder);

        var info = renderer.layoutInfoFromHolder($holder);
        if (!info || !info.editable) { return; }

        var options = info.editor.data('options');

        eventHandler.detach(info, options);
        renderer.removeLayout($holder, info, options);
      });

      return this;
    }
  });
}));
(function ($) {
  $.extend($.summernote.lang, {
    'ar-AR': {
      font: {
        bold: 'عريض',
        italic: 'مائل',
        underline: 'تحته خط',
        clear: 'مسح التنسيق',
        height: 'إرتفاع السطر',
        name: 'الخط'
      },
      image: {
        image: 'صورة',
        insert: 'إضافة صورة',
        resizeFull: 'الحجم بالكامل',
        resizeHalf: 'تصغير للنصف',
        resizeQuarter: 'تصغير للربع',
        floatLeft: 'تطيير لليسار',
        floatRight: 'تطيير لليمين',
        floatNone: 'ثابته',
        dragImageHere: 'إدرج الصورة هنا',
        selectFromFiles: 'حدد ملف',
        url: 'رابط الصورة',
        remove: 'حذف الصورة'
      },
      link: {
        link: 'رابط رابط',
        insert: 'إدراج',
        unlink: 'حذف الرابط',
        edit: 'تعديل',
        textToDisplay: 'النص',
        url: 'مسار الرابط',
        openInNewWindow: 'فتح في نافذة جديدة'
      },
      table: {
        table: 'جدول'
      },
      hr: {
        insert: 'إدراج خط أفقي'
      },
      style: {
        style: 'تنسيق',
        normal: 'عادي',
        blockquote: 'إقتباس',
        pre: 'شفيرة',
        h1: 'عنوان رئيسي 1',
        h2: 'عنوان رئيسي 2',
        h3: 'عنوان رئيسي 3',
        h4: 'عنوان رئيسي 4',
        h5: 'عنوان رئيسي 5',
        h6: 'عنوان رئيسي 6'
      },
      lists: {
        unordered: 'قائمة مُنقطة',
        ordered: 'قائمة مُرقمة'
      },
      options: {
        help: 'مساعدة',
        fullscreen: 'حجم الشاشة بالكامل',
        codeview: 'شفيرة المصدر'
      },
      paragraph: {
        paragraph: 'فقرة',
        outdent: 'محاذاة للخارج',
        indent: 'محاذاة للداخل',
        left: 'محاذاة لليسار',
        center: 'توسيط',
        right: 'محاذاة لليمين',
        justify: 'ملئ السطر'
      },
      color: {
        recent: 'تم إستخدامه',
        more: 'المزيد',
        background: 'لون الخلفية',
        foreground: 'لون النص',
        transparent: 'شفاف',
        setTransparent: 'بدون خلفية',
        reset: 'إعادة الضبط',
        resetToDefault: 'إعادة الضبط'
      },
      shortcut: {
        shortcuts: 'إختصارات',
        close: 'غلق',
        textFormatting: 'تنسيق النص',
        action: 'Action',
        paragraphFormatting: 'تنسيق الفقرة',
        documentStyle: 'تنسيق المستند'
      },
      history: {
        undo: 'تراجع',
        redo: 'إعادة'
      }
    }
  });
})(jQuery);
(function ($) {
  $.extend($.summernote.lang, {
    'ca-ES': {
      font: {
        bold: 'Negreta',
        italic: 'Cursiva',
        underline: 'Subratllat',
        clear: 'Treure estil de lletra',
        height: 'Alçada de línia'
      },
      image: {
        image: 'Imatge',
        insert: 'Inserir imatge',
        resizeFull: 'Redimensionar a mida completa',
        resizeHalf: 'Redimensionar a la meitat',
        resizeQuarter: 'Redimensionar a un quart',
        floatLeft: 'Surar a l%27esquerra',
        floatRight: 'Surar a la dreta',
        floatNone: 'No surar',
        dragImageHere: 'Arrossegueu una imatge aquí',
        selectFromFiles: 'Seleccioneu des dels arxius',
        url: 'URL de la imatge'
      },
      link: {
        link: 'Enllaç',
        insert: 'Inserir enllaç',
        unlink: 'Treure enllaç',
        edit: 'Editar',
        textToDisplay: 'Text per mostrar',
        url: 'Cap a quina URL porta l\'enllaç?',
        openInNewWindow: 'Obrir en una finestra nova'
      },
      table: {
        table: 'Taula'
      },
      hr: {
        insert: 'Inserir línia horitzontal'
      },
      style: {
        style: 'Estil',
        normal: 'Normal',
        blockquote: 'Cita',
        pre: 'Codi',
        h1: 'Títol 1',
        h2: 'Títol 2',
        h3: 'Títol 3',
        h4: 'Títol 4',
        h5: 'Títol 5',
        h6: 'Títol 6'
      },
      lists: {
        unordered: 'Llista desendreçada',
        ordered: 'Llista endreçada'
      },
      options: {
        help: 'Ajut',
        fullscreen: 'Pantalla sencera',
        codeview: 'Veure codi font'
      },
      paragraph: {
        paragraph: 'Paràgraf',
        outdent: 'Menys tabulació',
        indent: 'Més tabulació',
        left: 'Alinear a l\'esquerra',
        center: 'Alinear al mig',
        right: 'Alinear a la dreta',
        justify: 'Justificar'
      },
      color: {
        recent: 'Últim color',
        more: 'Més colors',
        background: 'Color de fons',
        foreground: 'Color de lletra',
        transparent: 'Transparent',
        setTransparent: 'Establir transparent',
        reset: 'Restablir',
        resetToDefault: 'Restablir per defecte'
      },
      shortcut: {
        shortcuts: 'Dreceres de teclat',
        close: 'Tancar',
        textFormatting: 'Format de text',
        action: 'Acció',
        paragraphFormatting: 'Format de paràgraf',
        documentStyle: 'Estil del document'
      },
      history: {
        undo: 'Desfer',
        redo: 'Refer'
      }
    }
  });
})(jQuery);
(function ($) {
  $.extend($.summernote.lang, {
    'cs-CZ': {
      font: {
        bold: 'Tučné',
        italic: 'Kurzíva',
        underline: 'Podtržené',
        clear: 'Odstranit styl písma',
        height: 'Výška řádku'
      },
      image: {
        image: 'Obrázek',
        insert: 'Vložit obrázek',
        resizeFull: 'Původní velikost',
        resizeHalf: 'Poloviční velikost',
        resizeQuarter: 'Čtvrteční velikost',
        floatLeft: 'Umístit doleva',
        floatRight: 'Umístit doprava',
        floatNone: 'Neobtékat textem',
        dragImageHere: 'Přetáhnout sem obrázek',
        selectFromFiles: 'Vybrat soubor',
        url: 'URL obrázku'
      },
      link: {
        link: 'Odkaz',
        insert: 'Vytvořit odkaz',
        unlink: 'Zrušit odkaz',
        edit: 'Upravit',
        textToDisplay: 'Zobrazovaný text',
        url: 'Na jaké URL má tento odkaz vést?',
        openInNewWindow: 'Otevřít v novém okně'
      },
      table: {
        table: 'Tabulka'
      },
      hr: {
        insert: 'Vložit vodorovnou čáru'
      },
      style: {
        style: 'Styl',
        normal: 'Normální',
        blockquote: 'Citace',
        pre: 'Kód',
        h1: 'Nadpis 1',
        h2: 'Nadpis 2',
        h3: 'Nadpis 3',
        h4: 'Nadpis 4',
        h5: 'Nadpis 5',
        h6: 'Nadpis 6'
      },
      lists: {
        unordered: 'Odrážkový seznam',
        ordered: 'Číselný seznam'
      },
      options: {
        help: 'Nápověda',
        fullscreen: 'Celá obrazovka',
        codeview: 'HTML kód'
      },
      paragraph: {
        paragraph: 'Odstavec',
        outdent: 'Zvětšit odsazení',
        indent: 'Zmenšit odsazení',
        left: 'Zarovnat doleva',
        center: 'Zarovnat na střed',
        right: 'Zarovnat doprava',
        justify: 'Zarovnat oboustranně'
      },
      color: {
        recent: 'Aktuální barva',
        more: 'Další barvy',
        background: 'Barva pozadí',
        foreground: 'Barva písma',
        transparent: 'Průhlednost',
        setTransparent: 'Nastavit průhlednost',
        reset: 'Obnovit',
        resetToDefault: 'Obnovit výchozí'
      },
      shortcut: {
        shortcuts: 'Klávesové zkratky',
        close: 'Zavřít',
        textFormatting: 'Formátování textu',
        action: 'Akce',
        paragraphFormatting: 'Formátování odstavce',
        documentStyle: 'Styl dokumentu'
      },
      history: {
        undo: 'Krok vzad',
        redo: 'Krok vpřed'
      }

    }
  });
})(jQuery);
(function ($) {
  $.extend($.summernote.lang, {
    'da-DK': {
      font: {
        bold: 'Fed',
        italic: 'Kursiv',
        underline: 'Understreget',
        clear: 'Fjern formatering',
        height: 'Højde',
        name: 'Skrifttype'
      },
      image: {
        image: 'Billede',
        insert: 'Indsæt billede',
        resizeFull: 'Original størrelse',
        resizeHalf: 'Halv størrelse',
        resizeQuarter: 'Kvart størrelse',
        floatLeft: 'Venstrestillet',
        floatRight: 'Højrestillet',
        floatNone: 'Fjern formatering',
        shapeRounded: 'Form: Runde kanter',
        shapeCircle: 'Form: Cirkel',
        shapeThumbnail: 'Form: Miniature',
        shapeNone: 'Form: Ingen',
        dragImageHere: 'Træk billede hertil',
        dropImage: 'Slip billede',
        selectFromFiles: 'Vælg billed-fil',
        maximumFileSize: 'Maks fil størrelse',
        maximumFileSizeError: 'Filen er større end maks tilladte fil størrelse!',
        url: 'Billede URL',
        remove: 'Fjern billede'
      },
      link: {
        link: 'Link',
        insert: 'Indsæt link',
        unlink: 'Fjern link',
        edit: 'Rediger',
        textToDisplay: 'Visningstekst',
        url: 'Hvor skal linket pege hen?',
        openInNewWindow: 'Åbn i nyt vindue'
      },
      table: {
        table: 'Tabel'
      },
      hr: {
        insert: 'Indsæt horisontal linje'
      },
      style: {
        style: 'Stil',
        normal: 'Normal',
        blockquote: 'Citat',
        pre: 'Kode',
        h1: 'Overskrift 1',
        h2: 'Overskrift 2',
        h3: 'Overskrift 3',
        h4: 'Overskrift 4',
        h5: 'Overskrift 5',
        h6: 'Overskrift 6'
      },
      lists: {
        unordered: 'Punktopstillet liste',
        ordered: 'Nummereret liste'
      },
      options: {
        help: 'Hjælp',
        fullscreen: 'Fuld skærm',
        codeview: 'HTML-Visning'
      },
      paragraph: {
        paragraph: 'Afsnit',
        outdent: 'Formindsk indryk',
        indent: 'Forøg indryk',
        left: 'Venstrestillet',
        center: 'Centreret',
        right: 'Højrestillet',
        justify: 'Blokjuster'
      },
      color: {
        recent: 'Nyligt valgt farve',
        more: 'Flere farver',
        background: 'Baggrund',
        foreground: 'Forgrund',
        transparent: 'Transparent',
        setTransparent: 'Sæt transparent',
        reset: 'Nulstil',
        resetToDefault: 'Gendan standardindstillinger'
      },
      shortcut: {
        shortcuts: 'Genveje',
        close: 'Luk',
        textFormatting: 'Tekstformatering',
        action: 'Handling',
        paragraphFormatting: 'Afsnitsformatering',
        documentStyle: 'Dokumentstil'
      },
      history: {
        undo: 'Fortryd',
        redo: 'Annuller fortryd'
      }

    }
  });
})(jQuery);
(function ($) {
  $.extend($.summernote.lang, {
    'de-DE': {
      font: {
        bold: 'Fett',
        italic: 'Kursiv',
        underline: 'Unterstreichen',
        clear: 'Zurücksetzen',
        height: 'Zeilenhöhe'
      },
      image: {
        image: 'Grafik',
        insert: 'Grafik einfügen',
        resizeFull: 'Originalgröße',
        resizeHalf: 'Größe 1/2',
        resizeQuarter: 'Größe 1/4',
        floatLeft: 'Linksbündig',
        floatRight: 'Rechtsbündig',
        floatNone: 'Kein Textfluss',
        dragImageHere: 'Ziehen Sie ein Bild mit der Maus hierher',
        selectFromFiles: 'Wählen Sie eine Datei aus',
        url: 'Grafik URL',
        remove: 'Grafik entfernen'
      },
      link: {
        link: 'Link',
        insert: 'Link einfügen',
        unlink: 'Link entfernen',
        edit: 'Editieren',
        textToDisplay: 'Anzeigetext',
        url: 'Ziel des Links?',
        openInNewWindow: 'In einem neuen Fenster öffnen'
      },
      table: {
        table: 'Tabelle'
      },
      hr: {
        insert: 'Eine horizontale Linie einfügen'
      },
      style: {
        style: 'Stil',
        normal: 'Normal',
        blockquote: 'Zitat',
        pre: 'Quellcode',
        h1: 'Überschrift 1',
        h2: 'Überschrift 2',
        h3: 'Überschrift 3',
        h4: 'Überschrift 4',
        h5: 'Überschrift 5',
        h6: 'Überschrift 6'
      },
      lists: {
        unordered: 'Aufzählung',
        ordered: 'Nummerierung'
      },
      options: {
        help: 'Hilfe',
        fullscreen: 'Vollbild',
        codeview: 'HTML-Code anzeigen'
      },
      paragraph: {
        paragraph: 'Absatz',
        outdent: 'Einzug vergrößern',
        indent: 'Einzug verkleinern',
        left: 'Links ausrichten',
        center: 'Zentriert ausrichten',
        right: 'Rechts ausrichten',
        justify: 'Blocksatz'
      },
      color: {
        recent: 'Letzte Farbe',
        more: 'Mehr Farben',
        background: 'Hintergrundfarbe',
        foreground: 'Schriftfarbe',
        transparent: 'Transparenz',
        setTransparent: 'Transparenz setzen',
        reset: 'Zurücksetzen',
        resetToDefault: 'Auf Standard zurücksetzen'
      },
      shortcut: {
        shortcuts: 'Tastenkürzel',
        close: 'Schließen',
        textFormatting: 'Textformatierung',
        action: 'Aktion',
        paragraphFormatting: 'Absatzformatierung',
        documentStyle: 'Dokumentenstil'
      },
      history: {
        undo: 'Rückgängig',
        redo: 'Wiederholen'
      }

    }
  });
})(jQuery);
(function ($) {
  $.extend($.summernote.lang, {
    'es-ES': {
      font: {
        bold: 'Negrita',
        italic: 'Cursiva',
        underline: 'Subrayado',
        clear: 'Quitar estilo de fuente',
        height: 'Altura de línea',
        name: 'Fuente'
      },
      image: {
        image: 'Imagen',
        insert: 'Insertar imagen',
        resizeFull: 'Redimensionar a tamaño completo',
        resizeHalf: 'Redimensionar a la mitad',
        resizeQuarter: 'Redimensionar a un cuarto',
        floatLeft: 'Flotar a la izquierda',
        floatRight: 'Flotar a la derecha',
        floatNone: 'No flotar',
        dragImageHere: 'Arrastrar una imagen aquí',
        selectFromFiles: 'Seleccionar desde los archivos',
        url: 'URL de la imagen'
      },
      link: {
        link: 'Link',
        insert: 'Insertar link',
        unlink: 'Quitar link',
        edit: 'Editar',
        textToDisplay: 'Texto para mostrar',
        url: '¿Hacia que URL lleva el link?',
        openInNewWindow: 'Abrir en una nueva ventana'
      },
      table: {
        table: 'Tabla'
      },
      hr: {
        insert: 'Insertar línea horizontal'
      },
      style: {
        style: 'Estilo',
        normal: 'Normal',
        blockquote: 'Cita',
        pre: 'Código',
        h1: 'Título 1',
        h2: 'Título 2',
        h3: 'Título 3',
        h4: 'Título 4',
        h5: 'Título 5',
        h6: 'Título 6'
      },
      lists: {
        unordered: 'Lista desordenada',
        ordered: 'Lista ordenada'
      },
      options: {
        help: 'Ayuda',
        fullscreen: 'Pantalla completa',
        codeview: 'Ver código fuente'
      },
      paragraph: {
        paragraph: 'Párrafo',
        outdent: 'Menos tabulación',
        indent: 'Más tabulación',
        left: 'Alinear a la izquierda',
        center: 'Alinear al centro',
        right: 'Alinear a la derecha',
        justify: 'Justificar'
      },
      color: {
        recent: 'Último color',
        more: 'Más colores',
        background: 'Color de fondo',
        foreground: 'Color de fuente',
        transparent: 'Transparente',
        setTransparent: 'Establecer transparente',
        reset: 'Restaurar',
        resetToDefault: 'Restaurar por defecto'
      },
      shortcut: {
        shortcuts: 'Atajos de teclado',
        close: 'Cerrar',
        textFormatting: 'Formato de texto',
        action: 'Acción',
        paragraphFormatting: 'Formato de párrafo',
        documentStyle: 'Estilo de documento'
      },
      history: {
        undo: 'Deshacer',
        redo: 'Rehacer'
      }
    }
  });
})(jQuery);
(function ($) {
  $.extend($.summernote.lang, {
    'es-EU': {
      font: {
        bold: 'Lodia',
        italic: 'Etzana',
        underline: 'Azpimarratua',
        clear: 'Estiloa kendu',
        height: 'Lerro altuera',
        name: 'Tipografia'
      },
      image: {
        image: 'Irudia',
        insert: 'Irudi bat txertatu',
        resizeFull: 'Jatorrizko neurrira aldatu',
        resizeHalf: 'Neurria erdira aldatu',
        resizeQuarter: 'Neurria laurdenera aldatu',
        floatLeft: 'Ezkerrean kokatu',
        floatRight: 'Eskuinean kokatu',
        floatNone: 'Kokapenik ez ezarri',
        dragImageHere: 'Irudi bat ezarri hemen',
        selectFromFiles: 'Zure fitxategi bat aukeratu',
        url: 'Irudiaren URL helbidea'
      },
      link: {
        link: 'Esteka',
        insert: 'Esteka bat txertatu',
        unlink: 'Esteka ezabatu',
        edit: 'Editatu',
        textToDisplay: 'Estekaren testua',
        url: 'Estekaren URL helbidea',
        openInNewWindow: 'Leiho berri batean ireki'
      },
      table: {
        table: 'Taula' //Tabla
      },
      hr: {
        insert: 'Marra horizontala txertatu' //Insertar línea horizontal
      },
      style: {
        style: 'Estiloa',
        normal: 'Normal',
        blockquote: 'Aipamena',
        pre: 'Kodea',
        h1: '1. izenburua',
        h2: '2. izenburua',
        h3: '3. izenburua',
        h4: '4. izenburua',
        h5: '5. izenburua',
        h6: '6. izenburua'
      },
      lists: {
        unordered: 'Ordenatu gabeko zerrenda',
        ordered: 'Zerrenda ordenatua'
      },
      options: {
        help: 'Laguntza',
        fullscreen: 'Pantaila osoa',
        codeview: 'Kodea ikusi'
      },
      paragraph: {
        paragraph: 'Paragrafoa',
        outdent: 'Koska txikiagoa',
        indent: 'Koska handiagoa',
        left: 'Ezkerrean kokatu',
        center: 'Erdian kokatu',
        right: 'Eskuinean kokatu',
        justify: 'Justifikatu'
      },
      color: {
        recent: 'Azken kolorea',
        more: 'Kolore gehiago',
        background: 'Atzeko planoa',
        foreground: 'Aurreko planoa',
        transparent: 'Gardena',
        setTransparent: 'Gardendu',
        reset: 'Lehengoratu',
        resetToDefault: 'Berrezarri lehenetsia'
      },
      shortcut: {
        shortcuts: 'Lasterbideak',
        close: 'Itxi',
        textFormatting: 'Testuaren formatua',
        action: 'Ekintza',
        paragraphFormatting: 'Paragrafoaren formatua',
        documentStyle: 'Dokumentuaren estiloa'
      },
      history: {
        undo: 'Desegin',
        redo: 'Berregin'
      }
    }
  });
})(jQuery);
(function ($) {
  $.extend($.summernote.lang, {
    'fa-IR': {
      font: {
        bold: 'درشت',
        italic: 'خمیده',
        underline: 'میان خط',
        clear: 'پاک کردن فرمت فونت',
        height: 'فاصله ی خطی',
        name: 'اسم فونت'
      },
      image: {
        image: 'تصویر',
        insert: 'وارد کردن تصویر',
        resizeFull: 'تغییر به اندازه ی کامل',
        resizeHalf: 'تغییر به اندازه نصف',
        resizeQuarter: 'تغییر به اندازه یک چهارم',
        floatLeft: 'چسباندن به چپ',
        floatRight: 'چسباندن به راست',
        floatNone: 'بدون چسبندگی',
        dragImageHere: 'یک تصویر را اینجا بکشید',
        selectFromFiles: 'فایل ها را انتخاب کنید',
        url: 'آدرس تصویر',
        remove: 'حذف تصویر'
      },
      link: {
        link: 'لینک',
        insert: 'اضافه کردن لینک',
        unlink: 'حذف لینک',
        edit: 'ویرایش',
        textToDisplay: 'متن جهت نمایش',
        url: 'این لینک به چه آدرسی باید برود ؟',
        openInNewWindow: 'در یک پنجره ی جدید باز شود'
      },
      table: {
        table: 'جدول'
      },
      hr: {
        insert: 'افزودن خط افقی'
      },
      style: {
        style: 'استیل',
        normal: 'نرمال',
        blockquote: 'نقل قول',
        pre: 'کد',
        h1: 'سرتیتر 1',
        h2: 'سرتیتر 2',
        h3: 'سرتیتر 3',
        h4: 'سرتیتر 4',
        h5: 'سرتیتر 5',
        h6: 'سرتیتر 6'
      },
      lists: {
        unordered: 'لیست غیر ترتیبی',
        ordered: 'لیست ترتیبی'
      },
      options: {
        help: 'راهنما',
        fullscreen: 'نمایش تمام صفحه',
        codeview: 'مشاهده ی کد'
      },
      paragraph: {
        paragraph: 'پاراگراف',
        outdent: 'کاهش تو رفتگی',
        indent: 'افزایش تو رفتگی',
        left: 'چپ چین',
        center: 'میان چین',
        right: 'راست چین',
        justify: 'بلوک چین'
      },
      color: {
        recent: 'رنگ اخیرا استفاده شده',
        more: 'رنگ بیشتر',
        background: 'رنگ پس زمینه',
        foreground: 'رنگ متن',
        transparent: 'بی رنگ',
        setTransparent: 'تنظیم حالت بی رنگ',
        reset: 'بازنشاندن',
        resetToDefault: 'حالت پیش فرض'
      },
      shortcut: {
        shortcuts: 'دکمه های میان بر',
        close: 'بستن',
        textFormatting: 'فرمت متن',
        action: 'عملیات',
        paragraphFormatting: 'فرمت پاراگراف',
        documentStyle: 'استیل سند'
      },
      history: {
        undo: 'واچیدن',
        redo: 'بازچیدن'
      }
    }
  });
})(jQuery);

(function ($) {
  $.extend($.summernote.lang, {
    'fi-FI': {
      font: {
        bold: 'Lihavoitu',
        italic: 'Kursiivi',
        underline: 'Alleviivaa',
        clear: 'Tyhjennä muotoilu',
        height: 'Riviväli',
        name: 'Kirjasintyyppi'
      },
      image: {
        image: 'Kuva',
        insert: 'Lisää kuva',
        resizeFull: 'Koko leveys',
        resizeHalf: 'Puolikas leveys',
        resizeQuarter: 'Neljäsosa leveys',
        floatLeft: 'Sijoita vasemmalle',
        floatRight: 'Sijoita oikealle',
        floatNone: 'Ei sijoitusta',
        dragImageHere: 'Vedä kuva tähän',
        selectFromFiles: 'Valitse tiedostoista',
        url: 'URL-osoitteen mukaan',
        remove: 'Poista kuva'
      },
      link: {
        link: 'Linkki',
        insert: 'Lisää linkki',
        unlink: 'Poista linkki',
        edit: 'Muokkaa',
        textToDisplay: 'Näytettävä teksti',
        url: 'Linkin URL-osoite?',
        openInNewWindow: 'Avaa uudessa ikkunassa'
      },
      table: {
        table: 'Taulukko'
      },
      hr: {
        insert: 'Lisää vaakaviiva'
      },
      style: {
        style: 'Tyyli',
        normal: 'Normaali',
        blockquote: 'Lainaus',
        pre: 'Koodi',
        h1: 'Otsikko 1',
        h2: 'Otsikko 2',
        h3: 'Otsikko 3',
        h4: 'Otsikko 4',
        h5: 'Otsikko 5',
        h6: 'Otsikko 6'
      },
      lists: {
        unordered: 'Luettelomerkitty luettelo',
        ordered: 'Numeroitu luettelo'
      },
      options: {
        help: 'Ohje',
        fullscreen: 'Koko näyttö',
        codeview: 'HTML-näkymä'
      },
      paragraph: {
        paragraph: 'Kappale',
        outdent: 'Pienennä sisennystä',
        indent: 'Suurenna sisennystä',
        left: 'Tasaus vasemmalle',
        center: 'Keskitä',
        right: 'Tasaus oikealle',
        justify: 'Tasaa'
      },
      color: {
        recent: 'Viimeisin väri',
        more: 'Lisää värejä',
        background: 'Taustaväri',
        foreground: 'Tekstin väri',
        transparent: 'Läpinäkyvä',
        setTransparent: 'Aseta läpinäkyväksi',
        reset: 'Palauta',
        resetToDefault: 'Palauta oletusarvoksi'
      },
      shortcut: {
        shortcuts: 'Pikanäppäimet',
        close: 'Sulje',
        textFormatting: 'Tekstin muotoilu',
        action: 'Toiminto',
        paragraphFormatting: 'Kappaleen muotoilu',
        documentStyle: 'Asiakirjan tyyli'
      },
      history: {
        undo: 'Kumoa',
        redo: 'Toista'
      }
    }
  });
})(jQuery);
(function ($) {
  $.extend($.summernote.lang, {
    'fr-FR': {
      font: {
        bold: 'Gras',
        italic: 'Italique',
        underline: 'Souligné',
        clear: 'Effacer la mise en forme',
        height: 'Interligne',
        name: 'Famille de police'
      },
      image: {
        image: 'Image',
        insert: 'Insérer une image',
        resizeFull: 'Taille originale',
        resizeHalf: 'Redimensionner à 50 %',
        resizeQuarter: 'Redimensionner à 25 %',
        floatLeft: 'Aligné à gauche',
        floatRight: 'Aligné à droite',
        floatNone: 'Pas d\'alignement',
        dragImageHere: 'Faites glisser une image avec la souris dans ce cadre',
        selectFromFiles: 'Choisir un fichier',
        url: 'URL de l\'image',
        remove: 'Supprimer l\'image'
      },
      link: {
        link: 'Lien',
        insert: 'Insérer un lien',
        unlink: 'Supprimer un lien',
        edit: 'Modifier',
        textToDisplay: 'Texte à afficher',
        url: 'URL du lien',
        openInNewWindow: 'Ouvrir dans une nouvelle fenêtre'
      },
      table: {
        table: 'Tableau'
      },
      hr: {
        insert: 'Insérer une ligne horizontale de séparation'
      },
      style: {
        style: 'Style',
        normal: 'Normal',
        blockquote: 'Citation',
        pre: 'Code source',
        h1: 'Titre 1',
        h2: 'Titre 2',
        h3: 'Titre 3',
        h4: 'Titre 4',
        h5: 'Titre 5',
        h6: 'Titre 6'
      },
      lists: {
        unordered: 'Liste à puces',
        ordered: 'Liste numérotée'
      },
      options: {
        help: 'Aide',
        fullscreen: 'Plein écran',
        codeview: 'Afficher le code HTML'
      },
      paragraph: {
        paragraph: 'Paragraphe',
        outdent: 'Diminuer le retrait',
        indent: 'Augmenter le retrait',
        left: 'Aligner à gauche',
        center: 'Centrer',
        right: 'Aligner à droite',
        justify: 'Justifier'
      },
      color: {
        recent: 'Dernière couleur sélectionnée',
        more: 'Plus de couleurs',
        background: 'Couleur de fond',
        foreground: 'Couleur de police',
        transparent: 'Transparent',
        setTransparent: 'Définir la transparence',
        reset: 'Restaurer',
        resetToDefault: 'Restaurer la couleur par défaut'
      },
      shortcut: {
        shortcuts: 'Raccourcis',
        close: 'Fermer',
        textFormatting: 'Mise en forme du texte',
        action: 'Action',
        paragraphFormatting: 'Mise en forme des paragraphes',
        documentStyle: 'Style du document'
      },
      history: {
        undo: 'Annuler la dernière action',
        redo: 'Restaurer la dernière action annulée'
      }

    }
  });
})(jQuery);
(function ($) {
  $.extend($.summernote.lang, {
    'he-IL': {
      font: {
        bold: 'מודגש',
        italic: 'נטוי',
        underline: 'קו תחתון',
        clear: 'נקה עיצוב',
        height: 'גובה',
        name: 'גופן'
      },
      image: {
        image: 'תמונה',
        insert: 'הוסף תמונה',
        resizeFull: 'גודל מלא',
        resizeHalf: 'להקטין לחצי',
        resizeQuarter: 'להקטין לרבע',
        floatLeft: 'יישור לשמאל',
        floatRight: 'יישור לימין',
        floatNone: 'ישר',
        dragImageHere: 'גרור תמונה לכאן',
        selectFromFiles: 'בחר מתוך קבצים',
        url: 'נתיב לתמונה',
        remove: 'הסר תמונה'
      },
      link: {
        link: 'קישור',
        insert: 'הוסף קישור',
        unlink: 'הסר קישור',
        edit: 'ערוך',
        textToDisplay: 'טקסט להציג',
        url: 'קישור',
        openInNewWindow: 'פתח בחלון חדש'
      },
      table: {
        table: 'טבלה'
      },
      hr: {
        insert: 'הוסף קו'
      },
      style: {
        style: 'עיצוב',
        normal: 'טקסט רגיל',
        blockquote: 'ציטוט',
        pre: 'קוד',
        h1: 'כותרת 1',
        h2: 'כותרת 2',
        h3: 'כותרת 3',
        h4: 'כותרת 4',
        h5: 'כותרת 5',
        h6: 'כותרת 6'
      },
      lists: {
        unordered: 'רשימת תבליטים',
        ordered: 'רשימה ממוספרת'
      },
      options: {
        help: 'עזרה',
        fullscreen: 'מסך מלא',
        codeview: 'תצוגת קוד'
      },
      paragraph: {
        paragraph: 'פסקה',
        outdent: 'הקטן כניסה',
        indent: 'הגדל כניסה',
        left: 'יישור לשמאל',
        center: 'יישור למרכז',
        right: 'יישור לימין',
        justify: 'מיושר'
      },
      color: {
        recent: 'צבע טקסט אחרון',
        more: 'עוד צבעים',
        background: 'צבע רקע',
        foreground: 'צבע טקסט',
        transparent: 'שקוף',
        setTransparent: 'קבע כשקוף',
        reset: 'איפוס',
        resetToDefault: 'אפס לברירת מחדל'
      },
      shortcut: {
        shortcuts: 'קיצורי מקלדת',
        close: 'סגור',
        textFormatting: 'עיצוב הטקסט',
        action: 'פעולה',
        paragraphFormatting: 'סגנונות פסקה',
        documentStyle: 'עיצוב המסמך',
        extraKeys: 'קיצורים נוספים'
      },
      history: {
        undo: 'בטל פעולה',
        redo: 'בצע שוב'
      }
    }
  });
})(jQuery);
(function ($) {
  $.extend($.summernote.lang, {
    'hu-HU': {
      font: {
        bold: 'Félkövér',
        italic: 'Dőlt',
        underline: 'Aláhúzott',
        clear: 'Formázás törlése',
        height: 'Sorköz',
        name: 'Betűtípus'
      },
      image: {
        image: 'Kép',
        insert: 'Kép beszúrása',
        resizeFull: 'Átméretezés teljes méretre',
        resizeHalf: 'Átméretezés felére',
        resizeQuarter: 'Átméretezés negyedére',
        floatLeft: 'Igazítás balra',
        floatRight: 'Igazítás jobbra',
        floatNone: 'Igazítás törlése',
        dragImageHere: 'Ide húzhatod a képet',
        selectFromFiles: 'Fájlok kiválasztása',
        url: 'Kép URL címe',
        remove: 'Kép törlése'
      },
      link: {
        link: 'Hivatkozás',
        insert: 'Hivatkozás beszúrása',
        unlink: 'Hivatkozás megszüntetése',
        edit: 'Szerkesztés',
        textToDisplay: 'Megjelenítendő szöveg',
        url: 'Milyen URL címre hivatkozzon?',
        openInNewWindow: 'Megnyitás új ablakban'
      },
      table: {
        table: 'Táblázat'
      },
      hr: {
        insert: 'Elválasztó vonal beszúrása'
      },
      style: {
        style: 'Stílus',
        normal: 'Normál',
        blockquote: 'Idézet',
        pre: 'Kód',
        h1: 'Fejléc 1',
        h2: 'Fejléc 2',
        h3: 'Fejléc 3',
        h4: 'Fejléc 4',
        h5: 'Fejléc 5',
        h6: 'Fejléc 6'
      },
      lists: {
        unordered: 'Listajeles lista',
        ordered: 'Számozott lista'
      },
      options: {
        help: 'Súgó',
        fullscreen: 'Teljes képernyő',
        codeview: 'Kód nézet'
      },
      paragraph: {
        paragraph: 'Bekezdés',
        outdent: 'Behúzás csökkentése',
        indent: 'Behúzás növelése',
        left: 'Igazítás balra',
        center: 'Igazítás középre',
        right: 'Igazítás jobbra',
        justify: 'Sorkizárt'
      },
      color: {
        recent: 'Jelenlegi szín',
        more: 'További színek',
        background: 'Háttérszín',
        foreground: 'Betűszín',
        transparent: 'Átlátszó',
        setTransparent: 'Átlászóság beállítása',
        reset: 'Visszaállítás',
        resetToDefault: 'Alaphelyzetbe állítás'
      },
      shortcut: {
        shortcuts: 'Gyorsbillentyű',
        close: 'Bezárás',
        textFormatting: 'Szöveg formázása',
        action: 'Művelet',
        paragraphFormatting: 'Bekezdés formázása',
        documentStyle: 'Dokumentumstílus'
      },
      history: {
        undo: 'Visszavonás',
        redo: 'Újra'
      }

    }
  });
})(jQuery);
(function ($) {
  $.extend($.summernote.lang, {
    'id-ID': {
      font: {
        bold: 'Tebal',
        italic: 'Miring',
        underline: 'Garis bawah',
        clear: 'Bersihkan gaya',
        height: 'Jarak baris'
      },
      image: {
        image: 'Gambar',
        insert: 'Sisipkan gambar',
        resizeFull: 'Ukuran penuh',
        resizeHalf: 'Ukuran 50%',
        resizeQuarter: 'Ukuran 25%',
        floatLeft: 'Rata kiri',
        floatRight: 'Rata kanan',
        floatNone: 'Tidak ada perataan',
        dragImageHere: 'Tarik gambar pada area ini',
        selectFromFiles: 'Pilih gambar dari berkas',
        url: 'URL gambar',
        remove: 'Hapus Gambar'
      },
      link: {
        link: 'Tautan',
        insert: 'Tambah tautan',
        unlink: 'Hapus tautan',
        edit: 'Edit',
        textToDisplay: 'Tampilan teks',
        url: 'Tautan tujuan',
        openInNewWindow: 'Buka di jendela baru'
      },
      table: {
        table: 'Tabel'
      },
      hr: {
        insert: 'Masukkan garis horizontal'
      },
      style: {
        style: 'Gaya',
        normal: 'Normal',
        blockquote: 'Kutipan',
        pre: 'Kode',
        h1: 'Heading 1',
        h2: 'Heading 2',
        h3: 'Heading 3',
        h4: 'Heading 4',
        h5: 'Heading 5',
        h6: 'Heading 6'
      },
      lists: {
        unordered: 'Pencacahan',
        ordered: 'Penomoran'
      },
      options: {
        help: 'Bantuan',
        fullscreen: 'Layar penuh',
        codeview: 'Kode HTML'
      },
      paragraph: {
        paragraph: 'Paragraf',
        outdent: 'Outdent',
        indent: 'Indent',
        left: 'Rata kiri',
        center: 'Rata tengah',
        right: 'Rata kanan',
        justify: 'Rata kanan kiri'
      },
      color: {
        recent: 'Warna sekarang',
        more: 'Selengkapnya',
        background: 'Warna latar',
        foreground: 'Warna font',
        transparent: 'Transparan',
        setTransparent: 'Atur transparansi',
        reset: 'Atur ulang',
        resetToDefault: 'Kembalikan kesemula'
      },
      shortcut: {
        shortcuts: 'Jalan pintas',
        close: 'Keluar',
        textFormatting: 'Format teks',
        action: 'Aksi',
        paragraphFormatting: 'Format paragraf',
        documentStyle: 'Gaya dokumen'
      },
      history: {
        undo: 'Kembali',
        redo: 'Ulang'
      }
    }
  });
})(jQuery);
(function ($) {
  $.extend($.summernote.lang, {
    'it-IT': {
      font: {
        bold: 'Testo in grassetto',
        italic: 'Testo in corsivo',
        underline: 'Testo sottolineato',
        clear: 'Elimina la formattazione del testo',
        height: 'Altezza della linea di testo',
        name: 'Famiglia Font'
      },
      image: {
        image: 'Immagine',
        insert: 'Inserisci Immagine',
        resizeFull: 'Dimensioni originali',
        resizeHalf: 'Ridimensiona al 50%',
        resizeQuarter: 'Ridimensiona al 25%',
        floatLeft: 'Posiziona a sinistra',
        floatRight: 'Posiziona a destra',
        floatNone: 'Nessun posizionamento',
        dragImageHere: 'Trascina qui un\'immagine',
        selectFromFiles: 'Scegli dai Documenti',
        url: 'URL dell\'immagine',
        remove: 'Rimuovi immagine'
      },
      link: {
        link: 'Collegamento',
        insert: 'Inserisci Collegamento',
        unlink: 'Elimina collegamento',
        edit: 'Modifica collegamento',
        textToDisplay: 'Testo del collegamento',
        url: 'URL del collegamento',
        openInNewWindow: 'Apri in una nuova finestra'
      },
      table: {
        table: 'Tabella'
      },
      hr: {
        insert: 'Inserisce una linea di separazione'
      },
      style: {
        style: 'Stili',
        normal: 'Normale',
        blockquote: 'Citazione',
        pre: 'Codice',
        h1: 'Titolo 1',
        h2: 'Titolo 2',
        h3: 'Titolo 3',
        h4: 'Titolo 4',
        h5: 'Titolo 5',
        h6: 'Titolo 6'
      },
      lists: {
        unordered: 'Elenco non ordinato',
        ordered: 'Elenco ordinato'
      },
      options: {
        help: 'Aiuto',
        fullscreen: 'Modalità a tutto schermo',
        codeview: 'Visualizza codice'
      },
      paragraph: {
        paragraph: 'Paragrafo',
        outdent: 'Diminuisce il livello di rientro',
        indent: 'Aumenta il livello di rientro',
        left: 'Allinea a sinistra',
        center: 'Centra',
        right: 'Allinea a destra',
        justify: 'Giustifica (allinea a destra e sinistra)'
      },
      color: {
        recent: 'Ultimo colore utilizzato',
        more: 'Altri colori',
        background: 'Colore di sfondo',
        foreground: 'Colore',
        transparent: 'Trasparente',
        setTransparent: 'Trasparente',
        reset: 'Reimposta',
        resetToDefault: 'Reimposta i colori'
      },
      shortcut: {
        shortcuts: 'Scorciatoie da tastiera',
        close: 'Chiudi',
        textFormatting: 'Formattazione testo',
        action: 'Azioni',
        paragraphFormatting: 'Formattazione paragrafo',
        documentStyle: 'Stili'
      },
      history: {
        undo: 'Annulla',
        redo: 'Ripristina'
      }
    }
  });
})(jQuery);
(function ($) {
  $.extend($.summernote.lang, {
    'ja-JP': {
      font: {
        bold: '太字',
        italic: '斜体',
        underline: '下線',
        clear: 'クリア',
        height: '文字高',
        name: 'フォント'
      },
      image: {
        image: '画像',
        insert: '画像挿入',
        resizeFull: '最大化',
        resizeHalf: '1/2',
        resizeQuarter: '1/4',
        floatLeft: '左寄せ',
        floatRight: '右寄せ',
        floatNone: '寄せ解除',
        dragImageHere: 'ここに画像をドラッグしてください',
        selectFromFiles: '画像ファイルを選ぶ',
        url: 'URLから画像を挿入する',
        remove: '画像を削除する'
      },
      link: {
        link: 'リンク',
        insert: 'リンク挿入',
        unlink: 'リンク解除',
        edit: '編集',
        textToDisplay: 'リンク文字列',
        url: 'URLを入力してください',
        openInNewWindow: '新しいウィンドウで開く'
      },
      table: {
        table: 'テーブル'
      },
      hr: {
        insert: '水平線の挿入'
      },
      style: {
        style: 'スタイル',
        normal: '標準',
        blockquote: '引用',
        pre: 'コード',
        h1: '見出し1',
        h2: '見出し2',
        h3: '見出し3',
        h4: '見出し4',
        h5: '見出し5',
        h6: '見出し6'
      },
      lists: {
        unordered: '通常リスト',
        ordered: '番号リスト'
      },
      options: {
        help: 'ヘルプ',
        fullscreen: 'フルスクリーン',
        codeview: 'コード表示'
      },
      paragraph: {
        paragraph: '文章',
        outdent: '字上げ',
        indent: '字下げ',
        left: '左寄せ',
        center: '中央寄せ',
        right: '右寄せ',
        justify: '均等割付'
      },
      color: {
        recent: '現在の色',
        more: 'もっと見る',
        background: '背景色',
        foreground: '文字色',
        transparent: '透過率',
        setTransparent: '透過率を設定',
        reset: '標準',
        resetToDefault: '標準に戻す'
      },
      shortcut: {
        shortcuts: 'ショートカット',
        close: '閉じる',
        textFormatting: '文字フォーマット',
        action: 'アクション',
        paragraphFormatting: '文章フォーマット',
        documentStyle: 'ドキュメント形式'
      },
      history: {
        undo: '元に戻す',
        redo: 'やり直す'
      }
    }
  });
})(jQuery);
(function ($) {
  $.extend($.summernote.lang, {
    'ko-KR': {
      font: {
        bold: '굵게',
        italic: '기울임꼴',
        underline: '밑줄',
        clear: '글자 효과 없애기',
        height: '줄간격',
        name: '글꼴'
      },
      image: {
        image: '사진',
        insert: '사진 추가',
        resizeFull: '원본 크기로 변경',
        resizeHalf: '50% 크기로 변경',
        resizeQuarter: '25% 크기로 변경',
        floatLeft: '왼쪽 정렬',
        floatRight: '오른쪽 정렬',
        floatNone: '정렬하지 않음',
        shapeRounded: '스타일: 둥근 모서리',
        shapeCircle: '스타일: 원형',
        shapeThumbnail: '스타일: 액자',
        shapeNone: '스타일: 없음',
        dragImageHere: '사진을 이곳으로 끌어오세요',
        selectFromFiles: '파일 선택',
        url: '사진 URL',
        remove: '사진 삭제'
      },
      link: {
        link: '링크',
        insert: '링크 추가',
        unlink: '링크 삭제',
        edit: '수정',
        textToDisplay: '링크에 표시할 내용',
        url: '이동할 URL',
        openInNewWindow: '새창으로 열기'
      },
      table: {
        table: '테이블'
      },
      hr: {
        insert: '구분선 추가'
      },
      style: {
        style: '스타일',
        normal: '본문',
        blockquote: '인용구',
        pre: '코드',
        h1: '제목 1',
        h2: '제목 2',
        h3: '제목 3',
        h4: '제목 4',
        h5: '제목 5',
        h6: '제목 6'
      },
      lists: {
        unordered: '글머리 기호',
        ordered: '번호 매기기'
      },
      options: {
        help: '도움말',
        fullscreen: '전체 화면',
        codeview: '코드 보기'
      },
      paragraph: {
        paragraph: '문단 정렬',
        outdent: '내어쓰기',
        indent: '들여쓰기',
        left: '왼쪽 정렬',
        center: '가운데 정렬',
        right: '오른쪽 정렬',
        justify: '양쪽 정렬'
      },
      color: {
        recent: '마지막으로 사용한 색',
        more: '다른 색 선택',
        background: '배경색',
        foreground: '글자색',
        transparent: '투명',
        setTransparent: '투명',
        reset: '취소',
        resetToDefault: '기본 값으로 변경'
      },
      shortcut: {
        shortcuts: '키보드 단축키',
        close: '닫기',
        textFormatting: '글자 스타일 적용',
        action: '기능',
        paragraphFormatting: '문단 스타일 적용',
        documentStyle: '문서 스타일 적용'
      },
      history: {
        undo: '실행 취소',
        redo: '다시 실행'
      }
    }
  });
})(jQuery);
(function ($) {
  $.extend($.summernote.lang, {
    'nb-NO': {
      font: {
        bold: 'Fet',
        italic: 'Kursiv',
        underline: 'Understrek',
        clear: 'Fjern formatering',
        height: 'Linjehøyde',
        name: 'Skrifttype'
      },
      image: {
        image: 'Bilde',
        insert: 'Sett inn bilde',
        resizeFull: 'Sett full størrelse',
        resizeHalf: 'Sett halv størrelse',
        resizeQuarter: 'Sett kvart størrelse',
        floatLeft: 'Flyt til venstre',
        floatRight: 'Flyt til høyre',
        floatNone: 'Fjern flyt',
        dragImageHere: 'Dra et bilde hit',
        selectFromFiles: 'Velg fra filer',
        url: 'Bilde-URL',
        remove: 'Fjern bilde'
      },
      link: {
        link: 'Lenke',
        insert: 'Sett inn lenke',
        unlink: 'Fjern lenke',
        edit: 'Rediger',
        textToDisplay: 'Visningstekst',
        url: 'Til hvilken URL skal denne lenken peke?',
        openInNewWindow: 'Åpne i nytt vindu'
      },
      table: {
        table: 'Tabell'
      },
      hr: {
        insert: 'Sett inn horisontal linje'
      },
      style: {
        style: 'Stil',
        normal: 'Normal',
        blockquote: 'Sitat',
        pre: 'Kode',
        h1: 'Overskrift 1',
        h2: 'Overskrift 2',
        h3: 'Overskrift 3',
        h4: 'Overskrift 4',
        h5: 'Overskrift 5',
        h6: 'Overskrift 6'
      },
      lists: {
        unordered: 'Punktliste',
        ordered: 'Nummerert liste'
      },
      options: {
        help: 'Hjelp',
        fullscreen: 'Fullskjerm',
        codeview: 'HTML-visning'
      },
      paragraph: {
        paragraph: 'Avsnitt',
        outdent: 'Tilbakerykk',
        indent: 'Innrykk',
        left: 'Venstrejustert',
        center: 'Midtstilt',
        right: 'Høyrejustert',
        justify: 'Blokkjustert'
      },
      color: {
        recent: 'Nylig valgt farge',
        more: 'Flere farger',
        background: 'Bakgrunnsfarge',
        foreground: 'Skriftfarge',
        transparent: 'Gjennomsiktig',
        setTransparent: 'Sett gjennomsiktig',
        reset: 'Nullstill',
        resetToDefault: 'Nullstill til standard'
      },
      shortcut: {
        shortcuts: 'Hurtigtaster',
        close: 'Lukk',
        textFormatting: 'Tekstformatering',
        action: 'Handling',
        paragraphFormatting: 'Avsnittsformatering',
        documentStyle: 'Dokumentstil'
      },
      history: {
        undo: 'Angre',
        redo: 'Gjør om'
      }
    }
  });
})(jQuery);
(function ($) {
  $.extend($.summernote.lang, {
    'nl-NL': {
      font: {
        bold: 'Vet',
        italic: 'Cursief',
        underline: 'Onderstrepen',
        clear: 'Stijl verwijderen',
        height: 'Regelhoogte',
        name: 'Lettertype'
      },
      image: {
        image: 'Afbeelding',
        insert: 'Afbeelding invoegen',
        resizeFull: 'Volledige breedte',
        resizeHalf: 'Halve breedte',
        resizeQuarter: 'Kwart breedte',
        floatLeft: 'Links uitlijnen',
        floatRight: 'Rechts uitlijnen',
        floatNone: 'Geen uitlijning',
        dragImageHere: 'Sleep hier een afbeelding naar toe',
        selectFromFiles: 'Selecteer een bestand',
        url: 'URL van de afbeelding',
        remove: 'Verwijder afbeelding'
      },
      link: {
        link: 'Link',
        insert: 'Link invoegen',
        unlink: 'Link verwijderen',
        edit: 'Wijzigen',
        textToDisplay: 'Tekst van link',
        url: 'Naar welke URL moet deze link verwijzen?',
        openInNewWindow: 'Open in nieuw venster'
      },
      table: {
        table: 'Tabel'
      },
      hr: {
        insert: 'Horizontale lijn invoegen'
      },
      style: {
        style: 'Stijl',
        normal: 'Normaal',
        blockquote: 'Quote',
        pre: 'Code',
        h1: 'Kop 1',
        h2: 'Kop 2',
        h3: 'Kop 3',
        h4: 'Kop 4',
        h5: 'Kop 5',
        h6: 'Kop 6'
      },
      lists: {
        unordered: 'Ongeordende lijst',
        ordered: 'Geordende lijst'
      },
      options: {
        help: 'Help',
        fullscreen: 'Volledig scherm',
        codeview: 'Bekijk Code'
      },
      paragraph: {
        paragraph: 'Paragraaf',
        outdent: 'Inspringen verkleinen',
        indent: 'Inspringen vergroten',
        left: 'Links uitlijnen',
        center: 'Centreren',
        right: 'Rechts uitlijnen',
        justify: 'Uitvullen'
      },
      color: {
        recent: 'Recente kleur',
        more: 'Meer kleuren',
        background: 'Achtergrond kleur',
        foreground: 'Tekst kleur',
        transparent: 'Transparant',
        setTransparent: 'Transparant',
        reset: 'Standaard',
        resetToDefault: 'Standaard kleur'
      },
      shortcut: {
        shortcuts: 'Toetsencombinaties',
        close: 'sluiten',
        textFormatting: 'Tekststijlen',
        action: 'Acties',
        paragraphFormatting: 'Paragraafstijlen',
        documentStyle: 'Documentstijlen'
      },
      history: {
        undo: 'Ongedaan maken',
        redo: 'Opnieuw doorvoeren'
      }
    }
  });
})(jQuery);
(function ($) {
  $.extend($.summernote.lang, {
    'pl-PL': {
      font: {
        bold: 'Pogrubienie',
        italic: 'Pochylenie',
        underline: 'Podkreślenie',
        clear: 'Usuń formatowanie',
        height: 'Interlinia',
        name: 'Czcionka'
      },
      image: {
        image: 'Grafika',
        insert: 'Wstaw grafikę',
        resizeFull: 'Zmień rozmiar na 100%',
        resizeHalf: 'Zmień rozmiar na 50%',
        resizeQuarter: 'Zmień rozmiar na 25%',
        floatLeft: 'Po lewej',
        floatRight: 'Po prawej',
        floatNone: 'Równo z tekstem',
        dragImageHere: 'Przeciągnij grafikę tutaj',
        selectFromFiles: 'Wybierz z dysku',
        url: 'URL grafiki',
        remove: 'Usuń grafikę'
      },
      link: {
        link: 'Odnośnik',
        insert: 'Wstaw odnośnik',
        unlink: 'Usuń odnośnik',
        edit: 'Edytuj',
        textToDisplay: 'Tekst do wyświetlenia',
        url: 'Na jaki URL powinien przenosić ten link?',
        openInNewWindow: 'Otwórz w nowym oknie'
      },
      table: {
        table: 'Tabela'
      },
      hr: {
        insert: 'Wstaw poziomą linię'
      },
      style: {
        style: 'Style',
        normal: 'Normalny',
        blockquote: 'Cytat',
        pre: 'Kod',
        h1: 'Nagłówek 1',
        h2: 'Nagłówek 2',
        h3: 'Nagłówek 3',
        h4: 'Nagłówek 4',
        h5: 'Nagłówek 5',
        h6: 'Nagłówek 6'
      },
      lists: {
        unordered: 'Lista wypunktowana',
        ordered: 'Lista numerowana'
      },
      options: {
        help: 'Pomoc',
        fullscreen: 'Pełny ekran',
        codeview: 'Zródło'
      },
      paragraph: {
        paragraph: 'Akapit',
        outdent: 'Zmniejsz wcięcie',
        indent: 'Zwiększ wcięcie',
        left: 'Wyrównaj do lewej',
        center: 'Wyrównaj do środka',
        right: 'Wyrównaj do prawej',
        justify: 'Wyrównaj do lewej i prawej'
      },
      color: {
        recent: 'Ostani kolor',
        more: 'Więcej kolorów',
        background: 'Tło',
        foreground: 'Czcionka',
        transparent: 'Przeźroczysty',
        setTransparent: 'Przeźroczyste',
        reset: 'Reset',
        resetToDefault: 'Domyślne'
      },
      shortcut: {
        shortcuts: 'Skróty klawiszone',
        close: 'Zamknij',
        textFormatting: 'Formatowanie tekstu',
        action: 'Akcja',
        paragraphFormatting: 'Formatowanie akapitu',
        documentStyle: 'Styl dokumentu'
      },
      history: {
        undo: 'Cofnij',
        redo: 'Ponów'
      }
    }
  });
})(jQuery);
(function ($) {
  $.extend($.summernote.lang, {
    'pt-BR': {
      font: {
        bold: 'Negrito',
        italic: 'Itálico',
        underline: 'Sublinhado',
        clear: 'Remover estilo da fonte',
        height: 'Altura da linha',
        name: 'Fonte'
      },
      image: {
        image: 'Imagem',
        insert: 'Inserir imagem',
        resizeFull: 'Resize Full',
        resizeHalf: 'Resize Half',
        resizeQuarter: 'Resize Quarter',
        floatLeft: 'Float Left',
        floatRight: 'Float Right',
        floatNone: 'Float None',
        dragImageHere: 'Arraste uma imagem para cá',
        selectFromFiles: 'Selecione a partir dos arquivos',
        url: 'URL da image'
      },
      link: {
        link: 'Link',
        insert: 'Inserir link',
        unlink: 'Remover link',
        edit: 'Editar',
        textToDisplay: 'Texto para exibir',
        url: 'Para qual URL esse link leva?',
        openInNewWindow: 'Abrir em uma nova janela'
      },
      table: {
        table: 'Tabela'
      },
      hr: {
        insert: 'Inserir linha horizontal'
      },
      style: {
        style: 'Estilo',
        normal: 'Normal',
        blockquote: 'Citação',
        pre: 'Código',
        h1: 'Título 1',
        h2: 'Título 2',
        h3: 'Título 3',
        h4: 'Título 4',
        h5: 'Título 5',
        h6: 'Título 6'
      },
      lists: {
        unordered: 'Lista com marcadores',
        ordered: 'Lista numerada'
      },
      options: {
        help: 'Ajuda',
        fullscreen: 'Tela cheia',
        codeview: 'Ver código-fonte'
      },
      paragraph: {
        paragraph: 'Parágrafo',
        outdent: 'Menor tabulação',
        indent: 'Maior tabulação',
        left: 'Alinhar à esquerda',
        center: 'Alinhar ao centro',
        right: 'Alinha à direita',
        justify: 'Justificado'
      },
      color: {
        recent: 'Cor recente',
        more: 'Mais cores',
        background: 'Fundo',
        foreground: 'Fonte',
        transparent: 'Transparente',
        setTransparent: 'Fundo transparente',
        reset: 'Restaurar',
        resetToDefault: 'Restaurar padrão'
      },
      shortcut: {
        shortcuts: 'Atalhos do teclado',
        close: 'Fechar',
        textFormatting: 'Formatação de texto',
        action: 'Ação',
        paragraphFormatting: 'Formatação de parágrafo',
        documentStyle: 'Estilo de documento'
      },
      history: {
        undo: 'Desfazer',
        redo: 'Refazer'
      }
    }
  });
})(jQuery);
(function ($) {
  $.extend($.summernote.lang, {
    'ro-RO': {
      font: {
        bold: 'Îngroșat',
        italic: 'Înclinat',
        underline: 'Subliniat',
        clear: 'Înlătură formatare font',
        height: 'Înălțime rând'
      },
      image: {
        image: 'Imagine',
        insert: 'Inserează imagine',
        resizeFull: 'Redimensionează complet',
        resizeHalf: 'Redimensionează 1/2',
        resizeQuarter: 'Redimensionează 1/4',
        floatLeft: 'Aliniere la stânga',
        floatRight: 'Aliniere la dreapta',
        floatNone: 'Fară aliniere',
        dragImageHere: 'Trage o imagine aici',
        selectFromFiles: 'Alege din fişiere',
        url: 'URL imagine'
      },
      link: {
        link: 'Link',
        insert: 'Inserează link',
        unlink: 'Înlătură link',
        edit: 'Editează',
        textToDisplay: 'Text ce va fi afişat',
        url: 'Deschidere în fereastra nouă?'
      },
      table: {
        table: 'Tabel'
      },
      hr: {
        insert: 'Inserează o linie orizontală'
      },
      style: {
        style: 'Stil',
        normal: 'Normal',
        blockquote: 'Citat',
        pre: 'Preformatat',
        h1: 'Titlu 1',
        h2: 'Titlu 2',
        h3: 'Titlu 3',
        h4: 'Titlu 4',
        h5: 'Titlu 5',
        h6: 'Titlu 6'
      },
      lists: {
        unordered: 'Listă neordonată',
        ordered: 'Listă ordonată'
      },
      options: {
        help: 'Ajutor',
        fullscreen: 'Măreşte',
        codeview: 'Sursă'
      },
      paragraph: {
        paragraph: 'Paragraf',
        outdent: 'Creşte identarea',
        indent: 'Scade identarea',
        left: 'Aliniere la stânga',
        center: 'Aliniere centrală',
        right: 'Aliniere la dreapta',
        justify: 'Aliniere în bloc'
      },
      color: {
        recent: 'Culoare recentă',
        more: 'Mai multe  culori',
        background: 'Culoarea fundalului',
        foreground: 'Culoarea textului',
        transparent: 'Transparent',
        setTransparent: 'Setează transparent',
        reset: 'Resetează',
        resetToDefault: 'Revino la iniţial'
      },
      shortcut: {
        shortcuts: 'Scurtături tastatură',
        close: 'Închide',
        textFormatting: 'Formatare text',
        action: 'Acţiuni',
        paragraphFormatting: 'Formatare paragraf',
        documentStyle: 'Stil paragraf'
      },
      history: {
        undo: 'Starea anterioară',
        redo: 'Starea ulterioară'
      }

    }
  });
})(jQuery);
(function ($) {
  $.extend($.summernote.lang, {
    'ru-RU': {
      font: {
        bold: 'Полужирный',
        italic: 'Курсив',
        underline: 'Подчёркнутый',
        clear: 'Убрать стили шрифта',
        height: 'Высота линии',
        name: 'Шрифт'
      },
      image: {
        image: 'Картинка',
        insert: 'Вставить картинку',
        resizeFull: 'Восстановить размер',
        resizeHalf: 'Уменьшить до 50%',
        resizeQuarter: 'Уменьшить до 25%',
        floatLeft: 'Расположить слева',
        floatRight: 'Расположить справа',
        floatNone: 'Расположение по-умолчанию',
        dragImageHere: 'Перетащите сюда картинку',
        selectFromFiles: 'Выбрать из файлов',
        url: 'URL картинки',
        remove: 'Удалить картинку'
      },
      link: {
        link: 'Ссылка',
        insert: 'Вставить ссылку',
        unlink: 'Убрать ссылку',
        edit: 'Редактировать',
        textToDisplay: 'Отображаемый текст',
        url: 'URL для перехода',
        openInNewWindow: 'Открывать в новом окне'
      },
      table: {
        table: 'Таблица'
      },
      hr: {
        insert: 'Вставить горизонтальную линию'
      },
      style: {
        style: 'Стиль',
        normal: 'Нормальный',
        blockquote: 'Цитата',
        pre: 'Код',
        h1: 'Заголовок 1',
        h2: 'Заголовок 2',
        h3: 'Заголовок 3',
        h4: 'Заголовок 4',
        h5: 'Заголовок 5',
        h6: 'Заголовок 6'
      },
      lists: {
        unordered: 'Маркированный список',
        ordered: 'Нумерованный список'
      },
      options: {
        help: 'Помощь',
        fullscreen: 'На весь экран',
        codeview: 'Исходный код'
      },
      paragraph: {
        paragraph: 'Параграф',
        outdent: 'Уменьшить отступ',
        indent: 'Увеличить отступ',
        left: 'Выровнять по левому краю',
        center: 'Выровнять по центру',
        right: 'Выровнять по правому краю',
        justify: 'Растянуть по ширине'
      },
      color: {
        recent: 'Последний цвет',
        more: 'Еще цвета',
        background: 'Цвет фона',
        foreground: 'Цвет шрифта',
        transparent: 'Прозрачный',
        setTransparent: 'Сделать прозрачным',
        reset: 'Сброс',
        resetToDefault: 'Восстановить умолчания'
      },
      shortcut: {
        shortcuts: 'Сочетания клавиш',
        close: 'Закрыть',
        textFormatting: 'Форматирование текста',
        action: 'Действие',
        paragraphFormatting: 'Форматирование параграфа',
        documentStyle: 'Стиль документа',
        extraKeys: 'Дополнительные комбинации'
      },
      history: {
        undo: 'Отменить',
        redo: 'Повтор'
      }
    }
  });
})(jQuery);
(function ($) {
  $.extend($.summernote.lang, {
    'sk-SK': {
      font: {
        bold: 'Tučné',
        italic: 'Kurzíva',
        underline: 'Podtržené',
        clear: 'Odstrániť štýl písma',
        height: 'Výška riadku'
      },
      image: {
        image: 'Obrázok',
        insert: 'Vložiť obrázok',
        resizeFull: 'Pôvodná veľkosť',
        resizeHalf: 'Polovičná veľkosť',
        resizeQuarter: 'Štvrtinová veľkosť',
        floatLeft: 'Umiestniť doľava',
        floatRight: 'Umiestniť doprava',
        floatNone: 'Bez zarovnania',
        dragImageHere: 'Pretiahnuť sem obrázok',
        selectFromFiles: 'Vybrať súbor',
        url: 'URL obrázku'
      },
      link: {
        link: 'Odkaz',
        insert: 'Vytvoriť odkaz',
        unlink: 'Zrušiť odkaz',
        edit: 'Upraviť',
        textToDisplay: 'Zobrazovaný text',
        url: 'Na akú URL adresu má tento odkaz viesť?',
        openInNewWindow: 'Otvoriť v novom okne'
      },
      table: {
        table: 'Tabuľka'
      },
      hr: {
        insert: 'Vložit vodorovnú čiaru'
      },
      style: {
        style: 'Štýl',
        normal: 'Normálny',
        blockquote: 'Citácia',
        pre: 'Kód',
        h1: 'Nadpis 1',
        h2: 'Nadpis 2',
        h3: 'Nadpis 3',
        h4: 'Nadpis 4',
        h5: 'Nadpis 5',
        h6: 'Nadpis 6'
      },
      lists: {
        unordered: 'Odrážkový zoznam',
        ordered: 'Číselný zoznam'
      },
      options: {
        help: 'Pomoc',
        fullscreen: 'Celá obrazovka',
        codeview: 'HTML kód'
      },
      paragraph: {
        paragraph: 'Odstavec',
        outdent: 'Zvečiť odsadenie',
        indent: 'Zmenšiť odsadenie',
        left: 'Zarovnať doľava',
        center: 'Zarovnať na stred',
        right: 'Zarovnať doprava',
        justify: 'Zarovnať obojstranne'
      },
      color: {
        recent: 'Aktuálna farba',
        more: 'Dalšie farby',
        background: 'Farba pozadia',
        foreground: 'Farba písma',
        transparent: 'Priehľednosť',
        setTransparent: 'Nastaviť priehľadnosť',
        reset: 'Obnoviť',
        resetToDefault: 'Obnoviť prednastavené'
      },
      shortcut: {
        shortcuts: 'Klávesové skratky',
        close: 'Zavrieť',
        textFormatting: 'Formátovanie textu',
        action: 'Akcia',
        paragraphFormatting: 'Formátovánie odstavca',
        documentStyle: 'Štýl dokumentu'
      },
      history: {
        undo: 'Krok vzad',
        redo: 'Krok dopredu'
      }
    }
  });
})(jQuery);
(function ($) {
  $.extend($.summernote.lang, {
    'sl-SI': {
      font: {
        bold: 'Krepko',
        italic: 'Ležeče',
        underline: 'Podčrtano',
        clear: 'Počisti oblikovanje izbire',
        height: 'Razmik med vrsticami',
        name: 'Pisava'
      },
      image: {
        image: 'Slika',
        insert: 'Vstavi sliko',
        resizeFull: 'Razširi na polno velikost',
        resizeHalf: 'Razširi na polovico velikosti',
        resizeQuarter: 'Razširi na četrtino velikosti',
        floatLeft: 'Leva poravnava',
        floatRight: 'Desna poravnava',
        floatNone: 'Brez poravnave',
        dragImageHere: 'Sem povlecite sliko',
        selectFromFiles: 'Izberi sliko za nalaganje',
        url: 'URL naslov slike',
        remove: 'Odstrani sliko'
      },
      link: {
        link: 'Povezava',
        insert: 'Vstavi povezavo',
        unlink: 'Odstrani povezavo',
        edit: 'Uredi',
        textToDisplay: 'Prikazano besedilo',
        url: 'Povezava',
        openInNewWindow: 'Odpri v novem oknu'
      },
      table: {
        table: 'Tabela'
      },
      hr: {
        insert: 'Vstavi horizontalno črto'
      },
      style: {
        style: 'Slogi',
        normal: 'Navadno besedilo',
        blockquote: 'Citat',
        pre: 'Koda',
        h1: 'Naslov 1',
        h2: 'Naslov 2',
        h3: 'Naslov 3',
        h4: 'Naslov 4',
        h5: 'Naslov 5',
        h6: 'Naslov 6'
      },
      lists: {
        unordered: 'Označen seznam',
        ordered: 'Oštevilčen seznam'
      },
      options: {
        help: 'Pomoč',
        fullscreen: 'Celozaslonski način',
        codeview: 'Pregled HTML kode'
      },
      paragraph: {
        paragraph: 'Slogi odstavka',
        outdent: 'Zmanjšaj odmik',
        indent: 'Povečaj odmik',
        left: 'Leva poravnava',
        center: 'Desna poravnava',
        right: 'Sredinska poravnava',
        justify: 'Obojestranska poravnava'
      },
      color: {
        recent: 'Uporabi zadnjo barvo',
        more: 'Več barv',
        background: 'Barva ozadja',
        foreground: 'Barva besedila',
        transparent: 'Brez barve',
        setTransparent: 'Brez barve',
        reset: 'Ponastavi',
        resetToDefault: 'Ponastavi na privzeto'
      },
      shortcut: {
        shortcuts: 'Bljižnice',
        close: 'Zapri',
        textFormatting: 'Oblikovanje besedila',
        action: 'Dejanja',
        paragraphFormatting: 'Oblikovanje odstavka',
        documentStyle: 'Oblikovanje naslova'
      },
      history: {
        undo: 'Razveljavi',
        redo: 'Uveljavi'
      }
    }
  });
})(jQuery);
(function ($) {
  $.extend($.summernote.lang, {
    'sr-RS': {
      font: {
        bold: 'Podebljano',
        italic: 'Kurziv',
        underline: 'Podvučeno',
        clear: 'Ukloni stilove fonta',
        height: 'Visina linije'
      },
      image: {
        image: 'Slika',
        insert: 'Umetni sliku',
        resizeFull: 'Puna veličina',
        resizeHalf: 'Umanji na 50%',
        resizeQuarter: 'Umanji na 25%',
        floatLeft: 'Uz levu ivicu',
        floatRight: 'Uz desnu ivicu',
        floatNone: 'Bez ravnanja',
        dragImageHere: 'Prevuci sliku ovde',
        selectFromFiles: 'Izaberi iz datoteke',
        url: 'Adresa slike',
        remove: 'Ukloni sliku'
      },
      link: {
        link: 'Veza',
        insert: 'Umetni vezu',
        unlink: 'Ukloni vezu',
        edit: 'Uredi',
        textToDisplay: 'Tekst za prikaz',
        url: 'Internet adresa',
        openInNewWindow: 'Otvori u novom prozoru'
      },
      table: {
        table: 'Tabela'
      },
      hr: {
        insert: 'Umetni horizontalnu liniju'
      },
      style: {
        style: 'Stil',
        normal: 'Normalni',
        blockquote: 'Citat',
        pre: 'Kod',
        h1: 'Zaglavlje 1',
        h2: 'Zaglavlje 2',
        h3: 'Zaglavlje 3',
        h4: 'Zaglavlje 4',
        h5: 'Zaglavlje 5',
        h6: 'Zaglavlje 6'
      },
      lists: {
        unordered: 'Obična lista',
        ordered: 'Numerisana lista'
      },
      options: {
        help: 'Pomoć',
        fullscreen: 'Preko celog ekrana',
        codeview: 'Izvorni kod'
      },
      paragraph: {
        paragraph: 'Paragraf',
        outdent: 'Smanji uvlačenje',
        indent: 'Povečaj uvlačenje',
        left: 'Poravnaj u levo',
        center: 'Centrirano',
        right: 'Poravnaj u desno',
        justify: 'Poravnaj obostrano'
      },
      color: {
        recent: 'Poslednja boja',
        more: 'Više boja',
        background: 'Boja pozadine',
        foreground: 'Boja teksta',
        transparent: 'Providna',
        setTransparent: 'Providna',
        reset: 'Opoziv',
        resetToDefault: 'Podrazumevana'
      },
      shortcut: {
        shortcuts: 'Prečice sa tastature',
        close: 'Zatvori',
        textFormatting: 'Formatiranje teksta',
        action: 'Akcija',
        paragraphFormatting: 'Formatiranje paragrafa',
        documentStyle: 'Stil dokumenta',
        extraKeys: 'Dodatne kombinacije'
      },
      history: {
        undo: 'Poništi',
        redo: 'Ponovi'
      }
    }
  });
})(jQuery);
(function ($) {
  $.extend($.summernote.lang, {
    'sr-RS': {
      font: {
        bold: 'Подебљано',
        italic: 'Курзив',
        underline: 'Подвучено',
        clear: 'Уклони стилове фонта',
        height: 'Висина линије'
      },
      image: {
        image: 'Слика',
        insert: 'Уметни слику',
        resizeFull: 'Пуна величина',
        resizeHalf: 'Умањи на 50%',
        resizeQuarter: 'Умањи на 25%',
        floatLeft: 'Уз леву ивицу',
        floatRight: 'Уз десну ивицу',
        floatNone: 'Без равнања',
        dragImageHere: 'Превуци слику овде',
        selectFromFiles: 'Изабери из датотеке',
        url: 'Адреса слике',
        remove: 'Уклони слику'
      },
      link: {
        link: 'Веза',
        insert: 'Уметни везу',
        unlink: 'Уклони везу',
        edit: 'Уреди',
        textToDisplay: 'Текст за приказ',
        url: 'Интернет адреса',
        openInNewWindow: 'Отвори у новом прозору'
      },
      table: {
        table: 'Табела'
      },
      hr: {
        insert: 'Уметни хоризонталну линију'
      },
      style: {
        style: 'Стил',
        normal: 'Нормални',
        blockquote: 'Цитат',
        pre: 'Код',
        h1: 'Заглавље 1',
        h2: 'Заглавље 2',
        h3: 'Заглавље 3',
        h4: 'Заглавље 4',
        h5: 'Заглавље 5',
        h6: 'Заглавље 6'
      },
      lists: {
        unordered: 'Обична листа',
        ordered: 'Нумерисана листа'
      },
      options: {
        help: 'Помоћ',
        fullscreen: 'Преко целог екрана',
        codeview: 'Изворни код'
      },
      paragraph: {
        paragraph: 'Параграф',
        outdent: 'Смањи увлачење',
        indent: 'Повечај увлачење',
        left: 'Поравнај у лево',
        center: 'Центрирано',
        right: 'Поравнај у десно',
        justify: 'Поравнај обострано'
      },
      color: {
        recent: 'Последња боја',
        more: 'Више боја',
        background: 'Боја позадине',
        foreground: 'Боја текста',
        transparent: 'Провидна',
        setTransparent: 'Провидна',
        reset: 'Опозив',
        resetToDefault: 'Подразумевана'
      },
      shortcut: {
        shortcuts: 'Пречице са тастатуре',
        close: 'Затвори',
        textFormatting: 'Форматирање текста',
        action: 'Акција',
        paragraphFormatting: 'Форматирање параграфа',
        documentStyle: 'Стил документа',
        extraKeys: 'Додатне комбинације'
      },
      history: {
        undo: 'Поништи',
        redo: 'Понови'
      }
    }
  });
})(jQuery);
(function ($) {
  $.extend($.summernote.lang, {
    'sv-SE': {
      font: {
        bold: 'Fet',
        italic: 'Kursiv',
        underline: 'Understruken',
        clear: 'Radera formatering',
        height: 'Radavstånd',
        name: 'Teckensnitt'
      },
      image: {
        image: 'Bild',
        insert: 'Infoga bild',
        resizeFull: 'Full storlek',
        resizeHalf: 'Halv storlek',
        resizeQuarter: 'En fjärdedel i storlek',
        floatLeft: 'Vänsterjusterad',
        floatRight: 'Högerjusterad',
        floatNone: 'Ingen justering',
        dragImageHere: 'Dra en bild hit',
        selectFromFiles: 'Välj från filer',
        url: 'Länk till bild',
        remove: 'Ta bort bild'
      },
      link: {
        link: 'Länk',
        insert: 'Infoga länk',
        unlink: 'Ta bort länk',
        edit: 'Redigera',
        textToDisplay: 'Visningstext',
        url: 'Till vilken URL ska denna länk peka?',
        openInNewWindow: 'Öppna i ett nytt fönster'
      },
      table: {
        table: 'Tabell'
      },
      hr: {
        insert: 'Infoga horisontell linje'
      },
      style: {
        style: 'Stil',
        normal: 'Normal',
        blockquote: 'Citat',
        pre: 'Kod',
        h1: 'Rubrik 1',
        h2: 'Rubrik 2',
        h3: 'Rubrik 3',
        h4: 'Rubrik 4',
        h5: 'Rubrik 5',
        h6: 'Rubrik 6'
      },
      lists: {
        unordered: 'Punktlista',
        ordered: 'Numrerad lista'
      },
      options: {
        help: 'Hjälp',
        fullscreen: 'Fullskärm',
        codeview: 'HTML-visning'
      },
      paragraph: {
        paragraph: 'Justera text',
        outdent: 'Minska indrag',
        indent: 'Öka indrag',
        left: 'Vänsterjusterad',
        center: 'Centrerad',
        right: 'Högerjusterad',
        justify: 'Justera text'
      },
      color: {
        recent: 'Senast använda färg',
        more: 'Fler färger',
        background: 'Bakgrundsfärg',
        foreground: 'Teckenfärg',
        transparent: 'Genomskinlig',
        setTransparent: 'Gör genomskinlig',
        reset: 'Nollställ',
        resetToDefault: 'Återställ till standard'
      },
      shortcut: {
        shortcuts: 'Kortkommandon',
        close: 'Stäng',
        textFormatting: 'Textformatering',
        action: 'Funktion',
        paragraphFormatting: 'Avsnittsformatering',
        documentStyle: 'Dokumentstil'
      },
      history: {
        undo: 'Ångra',
        redo: 'Gör om'
      }
    }
  });
})(jQuery);
(function ($) {
	$.extend($.summernote.lang, {
		'th-TH': {
			font: {
				bold: 'ตัวหนา',
				italic: 'ตัวเอียง',
				underline: 'ขีดเส้นใต้',
				clear: 'ล้างรูปแบบตัวอักษร',
				height: 'ความสูงบรรทัด',
				name: 'แบบตัวอักษร'
			},
			image: {
				image: 'รูปภาพ',
				insert: 'แทรกรูปภาพ',
				resizeFull: 'ปรับขนาดเท่าจริง',
				resizeHalf: 'ปรับขนาดลง 50%',
				resizeQuarter: 'ปรับขนาดลง 25%',
				floatLeft: 'ชิดซ้าย',
				floatRight: 'ชิดขวา',
				floatNone: 'ไม่จัดตำแหน่ง',
				dragImageHere: 'ลากรูปภาพที่ต้องการไว้ที่นี่',
				selectFromFiles: 'เลือกไฟล์รูปภาพ',
				url: 'ที่อยู่ URL ของรูปภาพ',
				remove: 'ลบรูปภาพ'
			},
			link: {
				link: 'ตัวเชื่อมโยง',
				insert: 'แทรกตัวเชื่อมโยง',
				unlink: 'ยกเลิกตัวเชื่อมโยง',
				edit: 'แก้ไข',
				textToDisplay: 'ข้อความที่ให้แสดง',
				url: 'ที่อยู่เว็บไซต์ที่ต้องการให้เชื่อมโยงไปถึง?',
				openInNewWindow: 'เปิดในหน้าต่างใหม่'
			},
			table: {
				table: 'ตาราง'
			},
			hr: {
				insert: 'แทรกเส้นคั่น'
			},
			style: {
				style: 'รูปแบบ',
				normal: 'ปกติ',
				blockquote: 'ข้อความ',
				pre: 'โค้ด',
				h1: 'หัวข้อ 1',
				h2: 'หัวข้อ 2',
				h3: 'หัวข้อ 3',
				h4: 'หัวข้อ 4',
				h5: 'หัวข้อ 5',
				h6: 'หัวข้อ 6'
			},
			lists: {
				unordered: 'รายการแบบไม่มีลำดับ',
				ordered: 'รายการแบบมีลำดับ'
			},
			options: {
				help: 'ช่วยเหลือ',
				fullscreen: 'ขยายเต็มหน้าจอ',
				codeview: 'ซอร์สโค้ด'
			},
			paragraph: {
				paragraph: 'ย่อหน้า',
				outdent: 'เยื้องซ้าย',
				indent: 'เยื้องขวา',
				left: 'จัดหน้าชิดซ้าย',
				center: 'จัดหน้ากึ่งกลาง',
				right: 'จัดหน้าชิดขวา',
				justify: 'จัดบรรทัดเสมอกัน'
			},
			color: {
				recent: 'สีที่ใช้ล่าสุด',
				more: 'สีอื่นๆ',
				background: 'สีพื้นหลัง',
				foreground: 'สีพื้นหน้า',
				transparent: 'โปร่งแสง',
				setTransparent: 'ตั้งค่าความโปร่งแสง',
				reset: 'คืนค่า',
				resetToDefault: 'คืนค่ามาตรฐาน'
			},
			shortcut: {
				shortcuts: 'แป้นลัด',
				close: 'ปิด',
				textFormatting: 'การจัดรูปแบบข้อความ',
				action: 'การกระทำ',
				paragraphFormatting: 'การจัดรูปแบบย่อหน้า',
				documentStyle: 'รูปแบบของเอกสาร'
			},
			history: {
				undo: 'ยกเลิกการกระทำ',
				redo: 'ทำซ้ำการกระทำ'
			}
		}
	});
})(jQuery);
(function ($) {
  $.extend($.summernote.lang, {
    'tr-TR': {
      font: {
        bold: 'Kalın',
        italic: 'İtalik',
        underline: 'Altı çizili',
        clear: 'Temizle',
        height: 'Satır yüksekliği',
        name: 'Yazı Tipi'
      },
      image: {
        image: 'Resim',
        insert: 'Resim ekle',
        resizeFull: 'Orjinal boyut',
        resizeHalf: '1/2 boyut',
        resizeQuarter: '1/4 boyut',
        floatLeft: 'Sola hizala',
        floatRight: 'Sağa hizala',
        floatNone: 'Hizalamayı kaldır',
        shapeRounded: 'Şekil: Yuvarlatılmış Köşe',
        shapeCircle: 'Şekil: Daire',
        shapeThumbnail: 'Şekil: K.Resim',
        shapeNone: 'Şekil: Yok',
        dragImageHere: 'Buraya sürükleyin',
        selectFromFiles: 'Dosya seçin',
        url: 'Resim bağlantısı',
        remove: 'Resimi Kaldır'
      },
      link: {
        link: 'Bağlantı',
        insert: 'Bağlantı ekle',
        unlink: 'Bağlantıyı kaldır',
        edit: 'Bağlantıyı düzenle',
        textToDisplay: 'Görüntülemek için',
        url: 'Bağlantı adresi?',
        openInNewWindow: 'Yeni pencerede aç'
      },
      table: {
        table: 'Tablo'
      },
      hr: {
        insert: 'Yatay çizgi ekle'
      },
      style: {
        style: 'Biçim',
        normal: 'Normal',
        blockquote: 'Alıntı',
        pre: 'Önbiçimli',
        h1: 'Başlık 1',
        h2: 'Başlık 2',
        h3: 'Başlık 3',
        h4: 'Başlık 4',
        h5: 'Başlık 5',
        h6: 'Başlık 6'
      },
      lists: {
        unordered: 'Madde işaretli liste',
        ordered: 'Numaralı liste'
      },
      options: {
        help: 'Yardım',
        fullscreen: 'Tam ekran',
        codeview: 'HTML Kodu'
      },
      paragraph: {
        paragraph: 'Paragraf',
        outdent: 'Girintiyi artır',
        indent: 'Girintiyi azalt',
        left: 'Sola hizala',
        center: 'Ortaya hizala',
        right: 'Sağa hizala',
        justify: 'Yasla'
      },
      color: {
        recent: 'Son renk',
        more: 'Daha fazla renk',
        background: 'Arka plan rengi',
        foreground: 'Yazı rengi',
        transparent: 'Seffaflık',
        setTransparent: 'Şeffaflığı ayarla',
        reset: 'Sıfırla',
        resetToDefault: 'Varsayılanlara sıfırla'
      },
      shortcut: {
        shortcuts: 'Kısayollar',
        close: 'Kapat',
        textFormatting: 'Yazı biçimlendirme',
        action: 'Eylem',
        paragraphFormatting: 'Paragraf biçimlendirme',
        documentStyle: 'Biçim'
      },
      history: {
        undo: 'Geri al',
        redo: 'Yeniden yap'
      }

    }
  });
})(jQuery);
(function ($) {
  $.extend($.summernote.lang, {
    'uk-UA': {
      font: {
        bold: 'Напівжирний',
        italic: 'Курсив',
        underline: 'Підкреслений',
        clear: 'Прибрати стилі шрифту',
        height: 'Висота лінії',
        name: 'Шрифт'
      },
      image: {
        image: 'Картинка',
        insert: 'Вставити картинку',
        resizeFull: 'Відновити розмір',
        resizeHalf: 'Зменшити до 50%',
        resizeQuarter: 'Зменшити до 25%',
        floatLeft: 'Розташувати ліворуч',
        floatRight: 'Розташувати праворуч',
        floatNone: 'Початкове розташування',
        dragImageHere: 'Перетягніть сюди картинку',
        selectFromFiles: 'Вибрати з файлів',
        url: 'URL картинки',
        remove: 'Видалити картинку'
      },
      link: {
        link: 'Посилання',
        insert: 'Вставити посилання',
        unlink: 'Прибрати посилання',
        edit: 'Редагувати',
        textToDisplay: 'Текст, що відображається',
        url: 'URL для переходу',
        openInNewWindow: 'Відкривати у новому вікні'
      },
      table: {
        table: 'Таблиця'
      },
      hr: {
        insert: 'Вставити горизонтальну лінію'
      },
      style: {
        style: 'Стиль',
        normal: 'Нормальний',
        blockquote: 'Цитата',
        pre: 'Код',
        h1: 'Заголовок 1',
        h2: 'Заголовок 2',
        h3: 'Заголовок 3',
        h4: 'Заголовок 4',
        h5: 'Заголовок 5',
        h6: 'Заголовок 6'
      },
      lists: {
        unordered: 'Маркований список',
        ordered: 'Нумерований список'
      },
      options: {
        help: 'Допомога',
        fullscreen: 'На весь екран',
        codeview: 'Початковий код'
      },
      paragraph: {
        paragraph: 'Параграф',
        outdent: 'Зменшити відступ',
        indent: 'Збільшити відступ',
        left: 'Вирівняти по лівому краю',
        center: 'Вирівняти по центру',
        right: 'Вирівняти по правому краю',
        justify: 'Розтягнути по ширині'
      },
      color: {
        recent: 'Останній колір',
        more: 'Ще кольори',
        background: 'Колір фону',
        foreground: 'Колір шрифту',
        transparent: 'Прозорий',
        setTransparent: 'Зробити прозорим',
        reset: 'Відновити',
        resetToDefault: 'Відновити початкові'
      },
      shortcut: {
        shortcuts: 'Комбінації клавіш',
        close: 'Закрити',
        textFormatting: 'Форматування тексту',
        action: 'Дія',
        paragraphFormatting: 'Форматування параграфу',
        documentStyle: 'Стиль документу'
      },
      history: {
        undo: 'Відмінити',
        redo: 'Повторити'
      }
    }
  });
})(jQuery);
(function ($) {
  $.extend($.summernote.lang, {
    'vi-VN': {
      font: {
        bold: 'In Đậm',
        italic: 'In Nghiên',
        underline: 'Gạch Dưới',
        clear: 'Bỏ Định Dạng',
        height: 'Khoảng Cách Hàng',
        name: 'Phông Chữ'
      },
      image: {
        image: 'Hình Ảnh',
        insert: 'Chèn',
        resizeFull: '100%',
        resizeHalf: '50%',
        resizeQuarter: '25%',
        floatLeft: 'Canh Trái',
        floatRight: 'Canh Phải',
        floatNone: 'Canh Đều',
        dragImageHere: 'Thả Ảnh Ở Đây',
        selectFromFiles: 'Chọn Từ Files',
        url: 'URL',
        remove: 'Ghỡ Bỏ'
      },
      link: {
        link: 'Đường Dẫn',
        insert: 'Chèn Đường Dẫn',
        unlink: 'Ghỡ Đường Dẫn',
        edit: 'Sửa',
        textToDisplay: 'Text Hiển Thị',
        url: 'URL',
        openInNewWindow: 'Mở ở Cửa Sổ Mới'
      },
      table: {
        table: 'Bảng'
      },
      hr: {
        insert: 'Chèn Vào'
      },
      style: {
        style: 'Kiểu Chữ',
        normal: 'Chữ Thường',
        blockquote: 'Đoạn Trích',
        pre: 'Mã Code',
        h1: 'H1',
        h2: 'H2',
        h3: 'H3',
        h4: 'H4',
        h5: 'H5',
        h6: 'H6'
      },
      lists: {
        unordered: 'Liệt Kê Danh Sách',
        ordered: 'Liệt Kê Theo Số'
      },
      options: {
        help: 'Trợ Giúp',
        fullscreen: 'Đầy Màn Hình',
        codeview: 'Xem Dạng Code'
      },
      paragraph: {
        paragraph: 'Canh Lề',
        outdent: 'Dịch Sang Trái',
        indent: 'Dịch Sang Phải',
        left: 'Canh Trái',
        center: 'Canh Giữa',
        right: 'Canh Phải',
        justify: 'Canh Đều'
      },
      color: {
        recent: 'Màu Chữ',
        more: 'Mở Rộng',
        background: 'Màu Nền',
        foreground: 'Màu Chữ',
        transparent: 'Trong Suốt',
        setTransparent: 'Nền Trong Suốt',
        reset: 'Thiệt Lập Lại',
        resetToDefault: 'Trở Lại Ban Đầu'
      },
      shortcut: {
        shortcuts: 'Phím Tắt',
        close: 'Đóng',
        textFormatting: 'Định Dạng Văn Bản',
        action: 'Hành Động',
        paragraphFormatting: 'Định Dạng',
        documentStyle: 'Kiểu Văn Bản'
      },
      history: {
        undo: 'Lùi Lại',
        redo: 'Làm Lại'
      }
    }
  });
})(jQuery);
(function ($) {
  $.extend($.summernote.lang, {
    'zh-CN': {
      font: {
        bold: '粗体',
        italic: '斜体',
        underline: '下划线',
        clear: '清除格式',
        height: '行高',
        name: '字体'
      },
      image: {
        image: '图片',
        insert: '插入图片',
        resizeFull: '调整至 100%',
        resizeHalf: '调整至 50%',
        resizeQuarter: '调整至 25%',
        floatLeft: '左浮动',
        floatRight: '右浮动',
        floatNone: '不浮动',
        dragImageHere: '将图片拖至此处',
        selectFromFiles: '从本地上传',
        url: '图片地址'
      },
      link: {
        link: '链接',
        insert: '插入链接',
        unlink: '去除链接',
        edit: '编辑链接',
        textToDisplay: '显示文本',
        url: '链接地址',
        openInNewWindow: '在新窗口打开'
      },
      table: {
        table: '表格'
      },
      hr: {
        insert: '水平线'
      },
      style: {
        style: '样式',
        normal: '普通',
        blockquote: '引用',
        pre: '代码',
        h1: '标题 1',
        h2: '标题 2',
        h3: '标题 3',
        h4: '标题 4',
        h5: '标题 5',
        h6: '标题 6'
      },
      lists: {
        unordered: '无序列表',
        ordered: '有序列表'
      },
      options: {
        help: '帮助',
        fullscreen: '全屏',
        codeview: '源代码'
      },
      paragraph: {
        paragraph: '段落',
        outdent: '减少缩进',
        indent: '增加缩进',
        left: '左对齐',
        center: '居中对齐',
        right: '右对齐',
        justify: '两端对齐'
      },
      color: {
        recent: '最近使用',
        more: '更多',
        background: '背景',
        foreground: '前景',
        transparent: '透明',
        setTransparent: '透明',
        reset: '重置',
        resetToDefault: '默认'
      },
      shortcut: {
        shortcuts: '快捷键',
        close: '关闭',
        textFormatting: '文本格式',
        action: '动作',
        paragraphFormatting: '段落格式',
        documentStyle: '文档样式'
      },
      history: {
        undo: '撤销',
        redo: '重做'
      }
    }
  });
})(jQuery);
(function ($) {
  $.extend($.summernote.lang, {
    'zh-TW': {
      font: {
        bold: '粗體',
        italic: '斜體',
        underline: '底線',
        clear: '清除格式',
        height: '行高'
      },
      image: {
        image: '圖片',
        insert: '插入圖片',
        resizeFull: '縮放至100%',
        resizeHalf: '縮放至 50%',
        resizeQuarter: '縮放至 25%',
        floatLeft: '靠左浮動',
        floatRight: '靠右浮動',
        floatNone: '取消浮動',
        dragImageHere: '將圖片拖曳至此處',
        selectFromFiles: '從本機上傳',
        url: '圖片網址'
      },
      link: {
        link: '連結',
        insert: '插入連結',
        unlink: '取消連結',
        edit: '編輯連結',
        textToDisplay: '顯示文字',
        url: '連結網址',
        openInNewWindow: '在新視窗開啟'
      },
      table: {
        table: '表格'
      },
      hr: {
        insert: '水平線'
      },
      style: {
        style: '樣式',
        normal: '一般',
        blockquote: '引用區塊',
        pre: '程式碼區塊',
        h1: '標題 1',
        h2: '標題 2',
        h3: '標題 3',
        h4: '標題 4',
        h5: '標題 5',
        h6: '標題 6'
      },
      lists: {
        unordered: '項目清單',
        ordered: '編號清單'
      },
      options: {
        help: '幫助',
        fullscreen: '全螢幕',
        codeview: '原始碼'
      },
      paragraph: {
        paragraph: '段落',
        outdent: '取消縮排',
        indent: '增加縮排',
        left: '靠右對齊',
        center: '靠中對齊',
        right: '靠右對齊',
        justify: '左右對齊'
      },
      color: {
        recent: '字型顏色',
        more: '更多',
        background: '背景',
        foreground: '前景',
        transparent: '透明',
        setTransparent: '透明',
        reset: '重設',
        resetToDefault: '默認'
      },
      shortcut: {
        shortcuts: '快捷鍵',
        close: '關閉',
        textFormatting: '文字格式',
        action: '動作',
        paragraphFormatting: '段落格式',
        documentStyle: '文件格式'
      },
      history: {
        undo: '復原',
        redo: '取消復原'
      }
    }
  });
})(jQuery);


(function() {
  var CSRFToken, Click, ComponentUrl, EVENTS, Link, ProgressBar, browserIsntBuggy, browserSupportsCustomEvents, browserSupportsPushState, browserSupportsTurbolinks, bypassOnLoadPopstate, cacheCurrentPage, cacheSize, changePage, clone, constrainPageCacheTo, createDocument, crossOriginRedirect, currentState, enableProgressBar, enableTransitionCache, executeScriptTags, extractTitleAndBody, fetch, fetchHistory, fetchReplacement, historyStateIsDefined, initializeTurbolinks, installDocumentReadyPageEventTriggers, installHistoryChangeHandler, installJqueryAjaxSuccessPageUpdateTrigger, loadedAssets, manuallyTriggerHashChangeForFirefox, pageCache, pageChangePrevented, pagesCached, popCookie, processResponse, progressBar, recallScrollPosition, referer, reflectNewUrl, reflectRedirectedUrl, rememberCurrentState, rememberCurrentUrl, rememberReferer, removeNoscriptTags, requestMethodIsSafe, resetScrollPosition, setAutofocusElement, transitionCacheEnabled, transitionCacheFor, triggerEvent, visit, xhr, _ref,
    __indexOf = [].indexOf || function(item) { for (var i = 0, l = this.length; i < l; i++) { if (i in this && this[i] === item) return i; } return -1; },
    __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; },
    __hasProp = {}.hasOwnProperty,
    __slice = [].slice,
    __bind = function(fn, me){ return function(){ return fn.apply(me, arguments); }; };

  pageCache = {};

  cacheSize = 10;

  transitionCacheEnabled = false;

  progressBar = null;

  currentState = null;

  loadedAssets = null;

  referer = null;

  xhr = null;

  EVENTS = {
    BEFORE_CHANGE: 'page:before-change',
    FETCH: 'page:fetch',
    RECEIVE: 'page:receive',
    CHANGE: 'page:change',
    UPDATE: 'page:update',
    LOAD: 'page:load',
    RESTORE: 'page:restore',
    BEFORE_UNLOAD: 'page:before-unload',
    EXPIRE: 'page:expire'
  };

  fetch = function(url) {
    var cachedPage;
    url = new ComponentUrl(url);
    rememberReferer();
    cacheCurrentPage();
    if (progressBar != null) {
      progressBar.start();
    }
    if (transitionCacheEnabled && (cachedPage = transitionCacheFor(url.absolute))) {
      fetchHistory(cachedPage);
      return fetchReplacement(url, null, false);
    } else {
      return fetchReplacement(url, resetScrollPosition);
    }
  };

  transitionCacheFor = function(url) {
    var cachedPage;
    cachedPage = pageCache[url];
    if (cachedPage && !cachedPage.transitionCacheDisabled) {
      return cachedPage;
    }
  };

  enableTransitionCache = function(enable) {
    if (enable == null) {
      enable = true;
    }
    return transitionCacheEnabled = enable;
  };

  enableProgressBar = function(enable) {
    if (enable == null) {
      enable = true;
    }
    if (!browserSupportsTurbolinks) {
      return;
    }
    if (enable) {
      return progressBar != null ? progressBar : progressBar = new ProgressBar('html');
    } else {
      if (progressBar != null) {
        progressBar.uninstall();
      }
      return progressBar = null;
    }
  };

  fetchReplacement = function(url, onLoadFunction, showProgressBar) {
    if (showProgressBar == null) {
      showProgressBar = true;
    }
    triggerEvent(EVENTS.FETCH, {
      url: url.absolute
    });
    if (xhr != null) {
      xhr.abort();
    }
    xhr = new XMLHttpRequest;
    xhr.open('GET', url.withoutHashForIE10compatibility(), true);
    xhr.setRequestHeader('Accept', 'text/html, application/xhtml+xml, application/xml');
    xhr.setRequestHeader('X-XHR-Referer', referer);
    xhr.onload = function() {
      var doc;
      triggerEvent(EVENTS.RECEIVE, {
        url: url.absolute
      });
      if (doc = processResponse()) {
        reflectNewUrl(url);
        reflectRedirectedUrl();
        changePage.apply(null, extractTitleAndBody(doc));
        manuallyTriggerHashChangeForFirefox();
        if (typeof onLoadFunction === "function") {
          onLoadFunction();
        }
        return triggerEvent(EVENTS.LOAD);
      } else {
        return document.location.href = crossOriginRedirect() || url.absolute;
      }
    };
    if (progressBar && showProgressBar) {
      xhr.onprogress = (function(_this) {
        return function(event) {
          var percent;
          percent = event.lengthComputable ? event.loaded / event.total * 100 : progressBar.value + (100 - progressBar.value) / 10;
          return progressBar.advanceTo(percent);
        };
      })(this);
    }
    xhr.onloadend = function() {
      return xhr = null;
    };
    xhr.onerror = function() {
      return document.location.href = url.absolute;
    };
    return xhr.send();
  };

  fetchHistory = function(cachedPage) {
    if (xhr != null) {
      xhr.abort();
    }
    changePage(cachedPage.title, cachedPage.body);
    recallScrollPosition(cachedPage);
    return triggerEvent(EVENTS.RESTORE);
  };

  cacheCurrentPage = function() {
    var currentStateUrl;
    currentStateUrl = new ComponentUrl(currentState.url);
    pageCache[currentStateUrl.absolute] = {
      url: currentStateUrl.relative,
      body: document.body,
      title: document.title,
      positionY: window.pageYOffset,
      positionX: window.pageXOffset,
      cachedAt: new Date().getTime(),
      transitionCacheDisabled: document.querySelector('[data-no-transition-cache]') != null
    };
    return constrainPageCacheTo(cacheSize);
  };

  pagesCached = function(size) {
    if (size == null) {
      size = cacheSize;
    }
    if (/^[\d]+$/.test(size)) {
      return cacheSize = parseInt(size);
    }
  };

  constrainPageCacheTo = function(limit) {
    var cacheTimesRecentFirst, key, pageCacheKeys, _i, _len, _results;
    pageCacheKeys = Object.keys(pageCache);
    cacheTimesRecentFirst = pageCacheKeys.map(function(url) {
      return pageCache[url].cachedAt;
    }).sort(function(a, b) {
      return b - a;
    });
    _results = [];
    for (_i = 0, _len = pageCacheKeys.length; _i < _len; _i++) {
      key = pageCacheKeys[_i];
      if (!(pageCache[key].cachedAt <= cacheTimesRecentFirst[limit])) {
        continue;
      }
      triggerEvent(EVENTS.EXPIRE, pageCache[key]);
      _results.push(delete pageCache[key]);
    }
    return _results;
  };

  changePage = function(title, body, csrfToken, runScripts) {
    triggerEvent(EVENTS.BEFORE_UNLOAD);
    document.title = title;
    document.documentElement.replaceChild(body, document.body);
    if (csrfToken != null) {
      CSRFToken.update(csrfToken);
    }
    setAutofocusElement();
    if (runScripts) {
      executeScriptTags();
    }
    currentState = window.history.state;
    if (progressBar != null) {
      progressBar.done();
    }
    triggerEvent(EVENTS.CHANGE);
    return triggerEvent(EVENTS.UPDATE);
  };

  executeScriptTags = function() {
    var attr, copy, nextSibling, parentNode, script, scripts, _i, _j, _len, _len1, _ref, _ref1;
    scripts = Array.prototype.slice.call(document.body.querySelectorAll('script:not([data-turbolinks-eval="false"])'));
    for (_i = 0, _len = scripts.length; _i < _len; _i++) {
      script = scripts[_i];
      if (!((_ref = script.type) === '' || _ref === 'text/javascript')) {
        continue;
      }
      copy = document.createElement('script');
      _ref1 = script.attributes;
      for (_j = 0, _len1 = _ref1.length; _j < _len1; _j++) {
        attr = _ref1[_j];
        copy.setAttribute(attr.name, attr.value);
      }
      if (!script.hasAttribute('async')) {
        copy.async = false;
      }
      copy.appendChild(document.createTextNode(script.innerHTML));
      parentNode = script.parentNode, nextSibling = script.nextSibling;
      parentNode.removeChild(script);
      parentNode.insertBefore(copy, nextSibling);
    }
  };

  removeNoscriptTags = function(node) {
    node.innerHTML = node.innerHTML.replace(/<noscript[\S\s]*?<\/noscript>/ig, '');
    return node;
  };

  setAutofocusElement = function() {
    var autofocusElement, list;
    autofocusElement = (list = document.querySelectorAll('input[autofocus], textarea[autofocus]'))[list.length - 1];
    if (autofocusElement && document.activeElement !== autofocusElement) {
      return autofocusElement.focus();
    }
  };

  reflectNewUrl = function(url) {
    if ((url = new ComponentUrl(url)).absolute !== referer) {
      return window.history.pushState({
        turbolinks: true,
        url: url.absolute
      }, '', url.absolute);
    }
  };

  reflectRedirectedUrl = function() {
    var location, preservedHash;
    if (location = xhr.getResponseHeader('X-XHR-Redirected-To')) {
      location = new ComponentUrl(location);
      preservedHash = location.hasNoHash() ? document.location.hash : '';
      return window.history.replaceState(window.history.state, '', location.href + preservedHash);
    }
  };

  crossOriginRedirect = function() {
    var redirect;
    if (((redirect = xhr.getResponseHeader('Location')) != null) && (new ComponentUrl(redirect)).crossOrigin()) {
      return redirect;
    }
  };

  rememberReferer = function() {
    return referer = document.location.href;
  };

  rememberCurrentUrl = function() {
    return window.history.replaceState({
      turbolinks: true,
      url: document.location.href
    }, '', document.location.href);
  };

  rememberCurrentState = function() {
    return currentState = window.history.state;
  };

  manuallyTriggerHashChangeForFirefox = function() {
    var url;
    if (navigator.userAgent.match(/Firefox/) && !(url = new ComponentUrl).hasNoHash()) {
      window.history.replaceState(currentState, '', url.withoutHash());
      return document.location.hash = url.hash;
    }
  };

  recallScrollPosition = function(page) {
    return window.scrollTo(page.positionX, page.positionY);
  };

  resetScrollPosition = function() {
    if (document.location.hash) {
      return document.location.href = document.location.href;
    } else {
      return window.scrollTo(0, 0);
    }
  };

  clone = function(original) {
    var copy, key, value;
    if ((original == null) || typeof original !== 'object') {
      return original;
    }
    copy = new original.constructor();
    for (key in original) {
      value = original[key];
      copy[key] = clone(value);
    }
    return copy;
  };

  popCookie = function(name) {
    var value, _ref;
    value = ((_ref = document.cookie.match(new RegExp(name + "=(\\w+)"))) != null ? _ref[1].toUpperCase() : void 0) || '';
    document.cookie = name + '=; expires=Thu, 01-Jan-70 00:00:01 GMT; path=/';
    return value;
  };

  triggerEvent = function(name, data) {
    var event;
    if (typeof Prototype !== 'undefined') {
      Event.fire(document, name, data, true);
    }
    event = document.createEvent('Events');
    if (data) {
      event.data = data;
    }
    event.initEvent(name, true, true);
    return document.dispatchEvent(event);
  };

  pageChangePrevented = function(url) {
    return !triggerEvent(EVENTS.BEFORE_CHANGE, {
      url: url
    });
  };

  processResponse = function() {
    var assetsChanged, clientOrServerError, doc, extractTrackAssets, intersection, validContent;
    clientOrServerError = function() {
      var _ref;
      return (400 <= (_ref = xhr.status) && _ref < 600);
    };
    validContent = function() {
      var contentType;
      return ((contentType = xhr.getResponseHeader('Content-Type')) != null) && contentType.match(/^(?:text\/html|application\/xhtml\+xml|application\/xml)(?:;|$)/);
    };
    extractTrackAssets = function(doc) {
      var node, _i, _len, _ref, _results;
      _ref = doc.querySelector('head').childNodes;
      _results = [];
      for (_i = 0, _len = _ref.length; _i < _len; _i++) {
        node = _ref[_i];
        if ((typeof node.getAttribute === "function" ? node.getAttribute('data-turbolinks-track') : void 0) != null) {
          _results.push(node.getAttribute('src') || node.getAttribute('href'));
        }
      }
      return _results;
    };
    assetsChanged = function(doc) {
      var fetchedAssets;
      loadedAssets || (loadedAssets = extractTrackAssets(document));
      fetchedAssets = extractTrackAssets(doc);
      return fetchedAssets.length !== loadedAssets.length || intersection(fetchedAssets, loadedAssets).length !== loadedAssets.length;
    };
    intersection = function(a, b) {
      var value, _i, _len, _ref, _results;
      if (a.length > b.length) {
        _ref = [b, a], a = _ref[0], b = _ref[1];
      }
      _results = [];
      for (_i = 0, _len = a.length; _i < _len; _i++) {
        value = a[_i];
        if (__indexOf.call(b, value) >= 0) {
          _results.push(value);
        }
      }
      return _results;
    };
    if (!clientOrServerError() && validContent()) {
      doc = createDocument(xhr.responseText);
      if (doc && !assetsChanged(doc)) {
        return doc;
      }
    }
  };

  extractTitleAndBody = function(doc) {
    var title;
    title = doc.querySelector('title');
    return [title != null ? title.textContent : void 0, removeNoscriptTags(doc.querySelector('body')), CSRFToken.get(doc).token, 'runScripts'];
  };

  CSRFToken = {
    get: function(doc) {
      var tag;
      if (doc == null) {
        doc = document;
      }
      return {
        node: tag = doc.querySelector('meta[name="csrf-token"]'),
        token: tag != null ? typeof tag.getAttribute === "function" ? tag.getAttribute('content') : void 0 : void 0
      };
    },
    update: function(latest) {
      var current;
      current = this.get();
      if ((current.token != null) && (latest != null) && current.token !== latest) {
        return current.node.setAttribute('content', latest);
      }
    }
  };

  createDocument = function(html) {
    var doc;
    doc = document.documentElement.cloneNode();
    doc.innerHTML = html;
    doc.head = doc.querySelector('head');
    doc.body = doc.querySelector('body');
    return doc;
  };

  ComponentUrl = (function() {
    function ComponentUrl(_at_original) {
      this.original = _at_original != null ? _at_original : document.location.href;
      if (this.original.constructor === ComponentUrl) {
        return this.original;
      }
      this._parse();
    }

    ComponentUrl.prototype.withoutHash = function() {
      return this.href.replace(this.hash, '').replace('#', '');
    };

    ComponentUrl.prototype.withoutHashForIE10compatibility = function() {
      return this.withoutHash();
    };

    ComponentUrl.prototype.hasNoHash = function() {
      return this.hash.length === 0;
    };

    ComponentUrl.prototype.crossOrigin = function() {
      return this.origin !== (new ComponentUrl).origin;
    };

    ComponentUrl.prototype._parse = function() {
      var _ref;
      (this.link != null ? this.link : this.link = document.createElement('a')).href = this.original;
      _ref = this.link, this.href = _ref.href, this.protocol = _ref.protocol, this.host = _ref.host, this.hostname = _ref.hostname, this.port = _ref.port, this.pathname = _ref.pathname, this.search = _ref.search, this.hash = _ref.hash;
      this.origin = [this.protocol, '//', this.hostname].join('');
      if (this.port.length !== 0) {
        this.origin += ":" + this.port;
      }
      this.relative = [this.pathname, this.search, this.hash].join('');
      return this.absolute = this.href;
    };

    return ComponentUrl;

  })();

  Link = (function(_super) {
    __extends(Link, _super);

    Link.HTML_EXTENSIONS = ['html'];

    Link.allowExtensions = function() {
      var extension, extensions, _i, _len;
      extensions = 1 <= arguments.length ? __slice.call(arguments, 0) : [];
      for (_i = 0, _len = extensions.length; _i < _len; _i++) {
        extension = extensions[_i];
        Link.HTML_EXTENSIONS.push(extension);
      }
      return Link.HTML_EXTENSIONS;
    };

    function Link(_at_link) {
      this.link = _at_link;
      if (this.link.constructor === Link) {
        return this.link;
      }
      this.original = this.link.href;
      this.originalElement = this.link;
      this.link = this.link.cloneNode(false);
      Link.__super__.constructor.apply(this, arguments);
    }

    Link.prototype.shouldIgnore = function() {
      return this.crossOrigin() || this._anchored() || this._nonHtml() || this._optOut() || this._target();
    };

    Link.prototype._anchored = function() {
      return (this.hash.length > 0 || this.href.charAt(this.href.length - 1) === '#') && (this.withoutHash() === (new ComponentUrl).withoutHash());
    };

    Link.prototype._nonHtml = function() {
      return this.pathname.match(/\.[a-z]+$/g) && !this.pathname.match(new RegExp("\\.(?:" + (Link.HTML_EXTENSIONS.join('|')) + ")?$", 'g'));
    };

    Link.prototype._optOut = function() {
      var ignore, link;
      link = this.originalElement;
      while (!(ignore || link === document)) {
        ignore = link.getAttribute('data-no-turbolink') != null;
        link = link.parentNode;
      }
      return ignore;
    };

    Link.prototype._target = function() {
      return this.link.target.length !== 0;
    };

    return Link;

  })(ComponentUrl);

  Click = (function() {
    Click.installHandlerLast = function(event) {
      if (!event.defaultPrevented) {
        document.removeEventListener('click', Click.handle, false);
        return document.addEventListener('click', Click.handle, false);
      }
    };

    Click.handle = function(event) {
      return new Click(event);
    };

    function Click(_at_event) {
      this.event = _at_event;
      if (this.event.defaultPrevented) {
        return;
      }
      this._extractLink();
      if (this._validForTurbolinks()) {
        if (!pageChangePrevented(this.link.absolute)) {
          visit(this.link.href);
        }
        this.event.preventDefault();
      }
    }

    Click.prototype._extractLink = function() {
      var link;
      link = this.event.target;
      while (!(!link.parentNode || link.nodeName === 'A')) {
        link = link.parentNode;
      }
      if (link.nodeName === 'A' && link.href.length !== 0) {
        return this.link = new Link(link);
      }
    };

    Click.prototype._validForTurbolinks = function() {
      return (this.link != null) && !(this.link.shouldIgnore() || this._nonStandardClick());
    };

    Click.prototype._nonStandardClick = function() {
      return this.event.which > 1 || this.event.metaKey || this.event.ctrlKey || this.event.shiftKey || this.event.altKey;
    };

    return Click;

  })();

  ProgressBar = (function() {
    var className;

    className = 'turbolinks-progress-bar';

    function ProgressBar(_at_elementSelector) {
      this.elementSelector = _at_elementSelector;
      this._trickle = __bind(this._trickle, this);
      this.value = 0;
      this.content = '';
      this.speed = 300;
      this.opacity = 0.99;
      this.install();
    }

    ProgressBar.prototype.install = function() {
      this.element = document.querySelector(this.elementSelector);
      this.element.classList.add(className);
      this.styleElement = document.createElement('style');
      document.head.appendChild(this.styleElement);
      return this._updateStyle();
    };

    ProgressBar.prototype.uninstall = function() {
      this.element.classList.remove(className);
      return document.head.removeChild(this.styleElement);
    };

    ProgressBar.prototype.start = function() {
      return this.advanceTo(5);
    };

    ProgressBar.prototype.advanceTo = function(value) {
      var _ref;
      if ((value > (_ref = this.value) && _ref <= 100)) {
        this.value = value;
        this._updateStyle();
        if (this.value === 100) {
          return this._stopTrickle();
        } else if (this.value > 0) {
          return this._startTrickle();
        }
      }
    };

    ProgressBar.prototype.done = function() {
      if (this.value > 0) {
        this.advanceTo(100);
        return this._reset();
      }
    };

    ProgressBar.prototype._reset = function() {
      var originalOpacity;
      originalOpacity = this.opacity;
      setTimeout((function(_this) {
        return function() {
          _this.opacity = 0;
          return _this._updateStyle();
        };
      })(this), this.speed / 2);
      return setTimeout((function(_this) {
        return function() {
          _this.value = 0;
          _this.opacity = originalOpacity;
          return _this._withSpeed(0, function() {
            return _this._updateStyle(true);
          });
        };
      })(this), this.speed);
    };

    ProgressBar.prototype._startTrickle = function() {
      if (this.trickling) {
        return;
      }
      this.trickling = true;
      return setTimeout(this._trickle, this.speed);
    };

    ProgressBar.prototype._stopTrickle = function() {
      return delete this.trickling;
    };

    ProgressBar.prototype._trickle = function() {
      if (!this.trickling) {
        return;
      }
      this.advanceTo(this.value + Math.random() / 2);
      return setTimeout(this._trickle, this.speed);
    };

    ProgressBar.prototype._withSpeed = function(speed, fn) {
      var originalSpeed, result;
      originalSpeed = this.speed;
      this.speed = speed;
      result = fn();
      this.speed = originalSpeed;
      return result;
    };

    ProgressBar.prototype._updateStyle = function(forceRepaint) {
      if (forceRepaint == null) {
        forceRepaint = false;
      }
      if (forceRepaint) {
        this._changeContentToForceRepaint();
      }
      return this.styleElement.textContent = this._createCSSRule();
    };

    ProgressBar.prototype._changeContentToForceRepaint = function() {
      return this.content = this.content === '' ? ' ' : '';
    };

    ProgressBar.prototype._createCSSRule = function() {
      return this.elementSelector + "." + className + "::before {\n  content: '" + this.content + "';\n  position: fixed;\n  top: 0;\n  left: 0;\n  z-index: 2000;\n  background-color: #0076ff;\n  height: 3px;\n  opacity: " + this.opacity + ";\n  width: " + this.value + "%;\n  transition: width " + this.speed + "ms ease-out, opacity " + (this.speed / 2) + "ms ease-in;\n  transform: translate3d(0,0,0);\n}";
    };

    return ProgressBar;

  })();

  bypassOnLoadPopstate = function(fn) {
    return setTimeout(fn, 500);
  };

  installDocumentReadyPageEventTriggers = function() {
    return document.addEventListener('DOMContentLoaded', (function() {
      triggerEvent(EVENTS.CHANGE);
      return triggerEvent(EVENTS.UPDATE);
    }), true);
  };

  installJqueryAjaxSuccessPageUpdateTrigger = function() {
    if (typeof jQuery !== 'undefined') {
      return jQuery(document).on('ajaxSuccess', function(event, xhr, settings) {
        if (!jQuery.trim(xhr.responseText)) {
          return;
        }
        return triggerEvent(EVENTS.UPDATE);
      });
    }
  };

  installHistoryChangeHandler = function(event) {
    var cachedPage, _ref;
    if ((_ref = event.state) != null ? _ref.turbolinks : void 0) {
      if (cachedPage = pageCache[(new ComponentUrl(event.state.url)).absolute]) {
        cacheCurrentPage();
        return fetchHistory(cachedPage);
      } else {
        return visit(event.target.location.href);
      }
    }
  };

  initializeTurbolinks = function() {
    rememberCurrentUrl();
    rememberCurrentState();
    document.addEventListener('click', Click.installHandlerLast, true);
    window.addEventListener('hashchange', function(event) {
      rememberCurrentUrl();
      return rememberCurrentState();
    }, false);
    return bypassOnLoadPopstate(function() {
      return window.addEventListener('popstate', installHistoryChangeHandler, false);
    });
  };

  historyStateIsDefined = window.history.state !== void 0 || navigator.userAgent.match(/Firefox\/2[6|7]/);

  browserSupportsPushState = window.history && window.history.pushState && window.history.replaceState && historyStateIsDefined;

  browserIsntBuggy = !navigator.userAgent.match(/CriOS\//);

  requestMethodIsSafe = (_ref = popCookie('request_method')) === 'GET' || _ref === '';

  browserSupportsTurbolinks = browserSupportsPushState && browserIsntBuggy && requestMethodIsSafe;

  browserSupportsCustomEvents = document.addEventListener && document.createEvent;

  if (browserSupportsCustomEvents) {
    installDocumentReadyPageEventTriggers();
    installJqueryAjaxSuccessPageUpdateTrigger();
  }

  if (browserSupportsTurbolinks) {
    visit = fetch;
    initializeTurbolinks();
  } else {
    visit = function(url) {
      return document.location.href = url;
    };
  }

  this.Turbolinks = {
    visit: visit,
    pagesCached: pagesCached,
    enableTransitionCache: enableTransitionCache,
    enableProgressBar: enableProgressBar,
    allowLinkExtensions: Link.allowExtensions,
    supported: browserSupportsTurbolinks,
    EVENTS: clone(EVENTS)
  };

}).call(this);
/*!

 handlebars v2.0.0

Copyright (C) 2011-2014 by Yehuda Katz

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.

@license
*/
/* exported Handlebars */

(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    define([], factory);
  } else if (typeof exports === 'object') {
    module.exports = factory();
  } else {
    root.Handlebars = root.Handlebars || factory();
  }
}(this, function () {
// handlebars/safe-string.js
var __module3__ = (function() {
  "use strict";
  var __exports__;
  // Build out our basic SafeString type
  function SafeString(string) {
    this.string = string;
  }

  SafeString.prototype.toString = function() {
    return "" + this.string;
  };

  __exports__ = SafeString;
  return __exports__;
})();

// handlebars/utils.js
var __module2__ = (function(__dependency1__) {
  "use strict";
  var __exports__ = {};
  /*jshint -W004 */
  var SafeString = __dependency1__;

  var escape = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#x27;",
    "`": "&#x60;"
  };

  var badChars = /[&<>"'`]/g;
  var possible = /[&<>"'`]/;

  function escapeChar(chr) {
    return escape[chr];
  }

  function extend(obj /* , ...source */) {
    for (var i = 1; i < arguments.length; i++) {
      for (var key in arguments[i]) {
        if (Object.prototype.hasOwnProperty.call(arguments[i], key)) {
          obj[key] = arguments[i][key];
        }
      }
    }

    return obj;
  }

  __exports__.extend = extend;var toString = Object.prototype.toString;
  __exports__.toString = toString;
  // Sourced from lodash
  // https://github.com/bestiejs/lodash/blob/master/LICENSE.txt
  var isFunction = function(value) {
    return typeof value === 'function';
  };
  // fallback for older versions of Chrome and Safari
  /* istanbul ignore next */
  if (isFunction(/x/)) {
    isFunction = function(value) {
      return typeof value === 'function' && toString.call(value) === '[object Function]';
    };
  }
  var isFunction;
  __exports__.isFunction = isFunction;
  /* istanbul ignore next */
  var isArray = Array.isArray || function(value) {
    return (value && typeof value === 'object') ? toString.call(value) === '[object Array]' : false;
  };
  __exports__.isArray = isArray;

  function escapeExpression(string) {
    // don't escape SafeStrings, since they're already safe
    if (string instanceof SafeString) {
      return string.toString();
    } else if (string == null) {
      return "";
    } else if (!string) {
      return string + '';
    }

    // Force a string conversion as this will be done by the append regardless and
    // the regex test will do this transparently behind the scenes, causing issues if
    // an object's to string has escaped characters in it.
    string = "" + string;

    if(!possible.test(string)) { return string; }
    return string.replace(badChars, escapeChar);
  }

  __exports__.escapeExpression = escapeExpression;function isEmpty(value) {
    if (!value && value !== 0) {
      return true;
    } else if (isArray(value) && value.length === 0) {
      return true;
    } else {
      return false;
    }
  }

  __exports__.isEmpty = isEmpty;function appendContextPath(contextPath, id) {
    return (contextPath ? contextPath + '.' : '') + id;
  }

  __exports__.appendContextPath = appendContextPath;
  return __exports__;
})(__module3__);

// handlebars/exception.js
var __module4__ = (function() {
  "use strict";
  var __exports__;

  var errorProps = ['description', 'fileName', 'lineNumber', 'message', 'name', 'number', 'stack'];

  function Exception(message, node) {
    var line;
    if (node && node.firstLine) {
      line = node.firstLine;

      message += ' - ' + line + ':' + node.firstColumn;
    }

    var tmp = Error.prototype.constructor.call(this, message);

    // Unfortunately errors are not enumerable in Chrome (at least), so `for prop in tmp` doesn't work.
    for (var idx = 0; idx < errorProps.length; idx++) {
      this[errorProps[idx]] = tmp[errorProps[idx]];
    }

    if (line) {
      this.lineNumber = line;
      this.column = node.firstColumn;
    }
  }

  Exception.prototype = new Error();

  __exports__ = Exception;
  return __exports__;
})();

// handlebars/base.js
var __module1__ = (function(__dependency1__, __dependency2__) {
  "use strict";
  var __exports__ = {};
  var Utils = __dependency1__;
  var Exception = __dependency2__;

  var VERSION = "2.0.0";
  __exports__.VERSION = VERSION;var COMPILER_REVISION = 6;
  __exports__.COMPILER_REVISION = COMPILER_REVISION;
  var REVISION_CHANGES = {
    1: '<= 1.0.rc.2', // 1.0.rc.2 is actually rev2 but doesn't report it
    2: '== 1.0.0-rc.3',
    3: '== 1.0.0-rc.4',
    4: '== 1.x.x',
    5: '== 2.0.0-alpha.x',
    6: '>= 2.0.0-beta.1'
  };
  __exports__.REVISION_CHANGES = REVISION_CHANGES;
  var isArray = Utils.isArray,
      isFunction = Utils.isFunction,
      toString = Utils.toString,
      objectType = '[object Object]';

  function HandlebarsEnvironment(helpers, partials) {
    this.helpers = helpers || {};
    this.partials = partials || {};

    registerDefaultHelpers(this);
  }

  __exports__.HandlebarsEnvironment = HandlebarsEnvironment;HandlebarsEnvironment.prototype = {
    constructor: HandlebarsEnvironment,

    logger: logger,
    log: log,

    registerHelper: function(name, fn) {
      if (toString.call(name) === objectType) {
        if (fn) { throw new Exception('Arg not supported with multiple helpers'); }
        Utils.extend(this.helpers, name);
      } else {
        this.helpers[name] = fn;
      }
    },
    unregisterHelper: function(name) {
      delete this.helpers[name];
    },

    registerPartial: function(name, partial) {
      if (toString.call(name) === objectType) {
        Utils.extend(this.partials,  name);
      } else {
        this.partials[name] = partial;
      }
    },
    unregisterPartial: function(name) {
      delete this.partials[name];
    }
  };

  function registerDefaultHelpers(instance) {
    instance.registerHelper('helperMissing', function(/* [args, ]options */) {
      if(arguments.length === 1) {
        // A missing field in a {{foo}} constuct.
        return undefined;
      } else {
        // Someone is actually trying to call something, blow up.
        throw new Exception("Missing helper: '" + arguments[arguments.length-1].name + "'");
      }
    });

    instance.registerHelper('blockHelperMissing', function(context, options) {
      var inverse = options.inverse,
          fn = options.fn;

      if(context === true) {
        return fn(this);
      } else if(context === false || context == null) {
        return inverse(this);
      } else if (isArray(context)) {
        if(context.length > 0) {
          if (options.ids) {
            options.ids = [options.name];
          }

          return instance.helpers.each(context, options);
        } else {
          return inverse(this);
        }
      } else {
        if (options.data && options.ids) {
          var data = createFrame(options.data);
          data.contextPath = Utils.appendContextPath(options.data.contextPath, options.name);
          options = {data: data};
        }

        return fn(context, options);
      }
    });

    instance.registerHelper('each', function(context, options) {
      if (!options) {
        throw new Exception('Must pass iterator to #each');
      }

      var fn = options.fn, inverse = options.inverse;
      var i = 0, ret = "", data;

      var contextPath;
      if (options.data && options.ids) {
        contextPath = Utils.appendContextPath(options.data.contextPath, options.ids[0]) + '.';
      }

      if (isFunction(context)) { context = context.call(this); }

      if (options.data) {
        data = createFrame(options.data);
      }

      if(context && typeof context === 'object') {
        if (isArray(context)) {
          for(var j = context.length; i<j; i++) {
            if (data) {
              data.index = i;
              data.first = (i === 0);
              data.last  = (i === (context.length-1));

              if (contextPath) {
                data.contextPath = contextPath + i;
              }
            }
            ret = ret + fn(context[i], { data: data });
          }
        } else {
          for(var key in context) {
            if(context.hasOwnProperty(key)) {
              if(data) {
                data.key = key;
                data.index = i;
                data.first = (i === 0);

                if (contextPath) {
                  data.contextPath = contextPath + key;
                }
              }
              ret = ret + fn(context[key], {data: data});
              i++;
            }
          }
        }
      }

      if(i === 0){
        ret = inverse(this);
      }

      return ret;
    });

    instance.registerHelper('if', function(conditional, options) {
      if (isFunction(conditional)) { conditional = conditional.call(this); }

      // Default behavior is to render the positive path if the value is truthy and not empty.
      // The `includeZero` option may be set to treat the condtional as purely not empty based on the
      // behavior of isEmpty. Effectively this determines if 0 is handled by the positive path or negative.
      if ((!options.hash.includeZero && !conditional) || Utils.isEmpty(conditional)) {
        return options.inverse(this);
      } else {
        return options.fn(this);
      }
    });

    instance.registerHelper('unless', function(conditional, options) {
      return instance.helpers['if'].call(this, conditional, {fn: options.inverse, inverse: options.fn, hash: options.hash});
    });

    instance.registerHelper('with', function(context, options) {
      if (isFunction(context)) { context = context.call(this); }

      var fn = options.fn;

      if (!Utils.isEmpty(context)) {
        if (options.data && options.ids) {
          var data = createFrame(options.data);
          data.contextPath = Utils.appendContextPath(options.data.contextPath, options.ids[0]);
          options = {data:data};
        }

        return fn(context, options);
      } else {
        return options.inverse(this);
      }
    });

    instance.registerHelper('log', function(message, options) {
      var level = options.data && options.data.level != null ? parseInt(options.data.level, 10) : 1;
      instance.log(level, message);
    });

    instance.registerHelper('lookup', function(obj, field) {
      return obj && obj[field];
    });
  }

  var logger = {
    methodMap: { 0: 'debug', 1: 'info', 2: 'warn', 3: 'error' },

    // State enum
    DEBUG: 0,
    INFO: 1,
    WARN: 2,
    ERROR: 3,
    level: 3,

    // can be overridden in the host environment
    log: function(level, message) {
      if (logger.level <= level) {
        var method = logger.methodMap[level];
        if (typeof console !== 'undefined' && console[method]) {
          console[method].call(console, message);
        }
      }
    }
  };
  __exports__.logger = logger;
  var log = logger.log;
  __exports__.log = log;
  var createFrame = function(object) {
    var frame = Utils.extend({}, object);
    frame._parent = object;
    return frame;
  };
  __exports__.createFrame = createFrame;
  return __exports__;
})(__module2__, __module4__);

// handlebars/runtime.js
var __module5__ = (function(__dependency1__, __dependency2__, __dependency3__) {
  "use strict";
  var __exports__ = {};
  var Utils = __dependency1__;
  var Exception = __dependency2__;
  var COMPILER_REVISION = __dependency3__.COMPILER_REVISION;
  var REVISION_CHANGES = __dependency3__.REVISION_CHANGES;
  var createFrame = __dependency3__.createFrame;

  function checkRevision(compilerInfo) {
    var compilerRevision = compilerInfo && compilerInfo[0] || 1,
        currentRevision = COMPILER_REVISION;

    if (compilerRevision !== currentRevision) {
      if (compilerRevision < currentRevision) {
        var runtimeVersions = REVISION_CHANGES[currentRevision],
            compilerVersions = REVISION_CHANGES[compilerRevision];
        throw new Exception("Template was precompiled with an older version of Handlebars than the current runtime. "+
              "Please update your precompiler to a newer version ("+runtimeVersions+") or downgrade your runtime to an older version ("+compilerVersions+").");
      } else {
        // Use the embedded version info since the runtime doesn't know about this revision yet
        throw new Exception("Template was precompiled with a newer version of Handlebars than the current runtime. "+
              "Please update your runtime to a newer version ("+compilerInfo[1]+").");
      }
    }
  }

  __exports__.checkRevision = checkRevision;// TODO: Remove this line and break up compilePartial

  function template(templateSpec, env) {
    /* istanbul ignore next */
    if (!env) {
      throw new Exception("No environment passed to template");
    }
    if (!templateSpec || !templateSpec.main) {
      throw new Exception('Unknown template object: ' + typeof templateSpec);
    }

    // Note: Using env.VM references rather than local var references throughout this section to allow
    // for external users to override these as psuedo-supported APIs.
    env.VM.checkRevision(templateSpec.compiler);

    var invokePartialWrapper = function(partial, indent, name, context, hash, helpers, partials, data, depths) {
      if (hash) {
        context = Utils.extend({}, context, hash);
      }

      var result = env.VM.invokePartial.call(this, partial, name, context, helpers, partials, data, depths);

      if (result == null && env.compile) {
        var options = { helpers: helpers, partials: partials, data: data, depths: depths };
        partials[name] = env.compile(partial, { data: data !== undefined, compat: templateSpec.compat }, env);
        result = partials[name](context, options);
      }
      if (result != null) {
        if (indent) {
          var lines = result.split('\n');
          for (var i = 0, l = lines.length; i < l; i++) {
            if (!lines[i] && i + 1 === l) {
              break;
            }

            lines[i] = indent + lines[i];
          }
          result = lines.join('\n');
        }
        return result;
      } else {
        throw new Exception("The partial " + name + " could not be compiled when running in runtime-only mode");
      }
    };

    // Just add water
    var container = {
      lookup: function(depths, name) {
        var len = depths.length;
        for (var i = 0; i < len; i++) {
          if (depths[i] && depths[i][name] != null) {
            return depths[i][name];
          }
        }
      },
      lambda: function(current, context) {
        return typeof current === 'function' ? current.call(context) : current;
      },

      escapeExpression: Utils.escapeExpression,
      invokePartial: invokePartialWrapper,

      fn: function(i) {
        return templateSpec[i];
      },

      programs: [],
      program: function(i, data, depths) {
        var programWrapper = this.programs[i],
            fn = this.fn(i);
        if (data || depths) {
          programWrapper = program(this, i, fn, data, depths);
        } else if (!programWrapper) {
          programWrapper = this.programs[i] = program(this, i, fn);
        }
        return programWrapper;
      },

      data: function(data, depth) {
        while (data && depth--) {
          data = data._parent;
        }
        return data;
      },
      merge: function(param, common) {
        var ret = param || common;

        if (param && common && (param !== common)) {
          ret = Utils.extend({}, common, param);
        }

        return ret;
      },

      noop: env.VM.noop,
      compilerInfo: templateSpec.compiler
    };

    var ret = function(context, options) {
      options = options || {};
      var data = options.data;

      ret._setup(options);
      if (!options.partial && templateSpec.useData) {
        data = initData(context, data);
      }
      var depths;
      if (templateSpec.useDepths) {
        depths = options.depths ? [context].concat(options.depths) : [context];
      }

      return templateSpec.main.call(container, context, container.helpers, container.partials, data, depths);
    };
    ret.isTop = true;

    ret._setup = function(options) {
      if (!options.partial) {
        container.helpers = container.merge(options.helpers, env.helpers);

        if (templateSpec.usePartial) {
          container.partials = container.merge(options.partials, env.partials);
        }
      } else {
        container.helpers = options.helpers;
        container.partials = options.partials;
      }
    };

    ret._child = function(i, data, depths) {
      if (templateSpec.useDepths && !depths) {
        throw new Exception('must pass parent depths');
      }

      return program(container, i, templateSpec[i], data, depths);
    };
    return ret;
  }

  __exports__.template = template;function program(container, i, fn, data, depths) {
    var prog = function(context, options) {
      options = options || {};

      return fn.call(container, context, container.helpers, container.partials, options.data || data, depths && [context].concat(depths));
    };
    prog.program = i;
    prog.depth = depths ? depths.length : 0;
    return prog;
  }

  __exports__.program = program;function invokePartial(partial, name, context, helpers, partials, data, depths) {
    var options = { partial: true, helpers: helpers, partials: partials, data: data, depths: depths };

    if(partial === undefined) {
      throw new Exception("The partial " + name + " could not be found");
    } else if(partial instanceof Function) {
      return partial(context, options);
    }
  }

  __exports__.invokePartial = invokePartial;function noop() { return ""; }

  __exports__.noop = noop;function initData(context, data) {
    if (!data || !('root' in data)) {
      data = data ? createFrame(data) : {};
      data.root = context;
    }
    return data;
  }
  return __exports__;
})(__module2__, __module4__, __module1__);

// handlebars.runtime.js
var __module0__ = (function(__dependency1__, __dependency2__, __dependency3__, __dependency4__, __dependency5__) {
  "use strict";
  var __exports__;
  /*globals Handlebars: true */
  var base = __dependency1__;

  // Each of these augment the Handlebars object. No need to setup here.
  // (This is done to easily share code between commonjs and browse envs)
  var SafeString = __dependency2__;
  var Exception = __dependency3__;
  var Utils = __dependency4__;
  var runtime = __dependency5__;

  // For compatibility and usage outside of module systems, make the Handlebars object a namespace
  var create = function() {
    var hb = new base.HandlebarsEnvironment();

    Utils.extend(hb, base);
    hb.SafeString = SafeString;
    hb.Exception = Exception;
    hb.Utils = Utils;
    hb.escapeExpression = Utils.escapeExpression;

    hb.VM = runtime;
    hb.template = function(spec) {
      return runtime.template(spec, hb);
    };

    return hb;
  };

  var Handlebars = create();
  Handlebars.create = create;

  Handlebars['default'] = Handlebars;

  __exports__ = Handlebars;
  return __exports__;
})(__module1__, __module3__, __module4__, __module2__, __module5__);

  return __module0__;
}));
var App = App || {};

(function(App){
  App.Campaign = Backbone.Model.extend({
        urlRoot: "/api/campaigns"
  });
})(App);
var App = App || {};

(function(App){
  App.Campaigns = Backbone.Collection.extend({
    url: "/api/campaigns",
    model: App.Campaign

  });

})(App);
(function() {
  this.HandlebarsTemplates || (this.HandlebarsTemplates = {});
  this.HandlebarsTemplates["application/layout"] = Handlebars.template({"compiler":[6,">= 2.0.0-beta.1"],"main":function(depth0,helpers,partials,data) {
  return "<div class=\"title-area\"></div>\n<div class=\"process-area\"></div>";
  },"useData":true});
  return this.HandlebarsTemplates["application/layout"];
}).call(this);
(function() {
  this.JST || (this.JST = {});
  this.JST["campaign/form"] = Handlebars.template({"compiler":[6,">= 2.0.0-beta.1"],"main":function(depth0,helpers,partials,data) {
  var helper, functionType="function", helperMissing=helpers.helperMissing, escapeExpression=this.escapeExpression;
  return "<form>\n  <p>\n    <input type=\"text\" name=\"name\" placeholder=\"Name\" value=\""
    + escapeExpression(((helper = (helper = helpers.name || (depth0 != null ? depth0.name : depth0)) != null ? helper : helperMissing),(typeof helper === functionType ? helper.call(depth0, {"name":"name","hash":{},"data":data}) : helper)))
    + "\">\n    <input type=\"text\" name=\"description\" placeholder=\"description\" value=\""
    + escapeExpression(((helper = (helper = helpers.description || (depth0 != null ? depth0.description : depth0)) != null ? helper : helperMissing),(typeof helper === functionType ? helper.call(depth0, {"name":"description","hash":{},"data":data}) : helper)))
    + "\">\n     <input type=\"color\" name=\"favcolor\">\n  </p>\n\n  <p>\n    <button class=\"save\" data-id=\""
    + escapeExpression(((helper = (helper = helpers.id || (depth0 != null ? depth0.id : depth0)) != null ? helper : helperMissing),(typeof helper === functionType ? helper.call(depth0, {"name":"id","hash":{},"data":data}) : helper)))
    + "\">Save</button>\n    <button class=\"cancel\">Cancel</button>\n  </p>\n</form>";
},"useData":true});
  return this.JST["campaign/form"];
}).call(this);
(function() {
  this.JST || (this.JST = {});
  this.JST["campaign/panel"] = Handlebars.template({"1":function(depth0,helpers,partials,data) {
  var helper, functionType="function", helperMissing=helpers.helperMissing, escapeExpression=this.escapeExpression;
  return "  <tr class=\"plane-row\" data-id="
    + escapeExpression(((helper = (helper = helpers.id || (depth0 != null ? depth0.id : depth0)) != null ? helper : helperMissing),(typeof helper === functionType ? helper.call(depth0, {"name":"id","hash":{},"data":data}) : helper)))
    + ">\n    <td>"
    + escapeExpression(((helper = (helper = helpers.name || (depth0 != null ? depth0.name : depth0)) != null ? helper : helperMissing),(typeof helper === functionType ? helper.call(depth0, {"name":"name","hash":{},"data":data}) : helper)))
    + "</td>\n    <td>"
    + escapeExpression(((helper = (helper = helpers.rows || (depth0 != null ? depth0.rows : depth0)) != null ? helper : helperMissing),(typeof helper === functionType ? helper.call(depth0, {"name":"rows","hash":{},"data":data}) : helper)))
    + "</td>\n    <td>"
    + escapeExpression(((helper = (helper = helpers.columns || (depth0 != null ? depth0.columns : depth0)) != null ? helper : helperMissing),(typeof helper === functionType ? helper.call(depth0, {"name":"columns","hash":{},"data":data}) : helper)))
    + "</td>\n  </tr> \n";
},"compiler":[6,">= 2.0.0-beta.1"],"main":function(depth0,helpers,partials,data) {
  var stack1, buffer = "<h2>Campaigns</h2>\n\n<button class=\"create-campaign\">Create Campaign</button>\n\n<table>\n  <tr>\n    <th>Name</th>\n    <th>Campaign</th>\n    <th>Columns</th>\n  </tr>\n";
  stack1 = helpers.each.call(depth0, (depth0 != null ? depth0.planes : depth0), {"name":"each","hash":{},"fn":this.program(1, data),"inverse":this.noop,"data":data});
  if (stack1 != null) { buffer += stack1; }
  return buffer + "</table>";
},"useData":true});
  return this.JST["campaign/panel"];
}).call(this);
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
(function() {


}).call(this);
(function() {


}).call(this);
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
(function() {


}).call(this);
// This is a manifest file that'll be compiled into application.js, which will include all the files
// listed below.
//
// Any JavaScript/Coffee file within this directory, lib/assets/javascripts, vendor/assets/javascripts,
// or any plugin's vendor/assets/javascripts directory can be referenced here using a relative path.
//
// It's not advisable to add code directly here, but if you do, it'll appear at the bottom of the
// compiled file.
//
// Read Sprockets README (https://github.com/sstephenson/sprockets#sprockets-directives) for details
// about supported directives.
//











$('[data-provider="summernote"]').each(function(){
  $(this).summernote({ });
})

var App = App || {};
(function(App){
 Backbone.history.start();

})(App);


