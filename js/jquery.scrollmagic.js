/*
	@overview
	ScrollMagic - The jQuery plugin for doing magical scroll animations
	by Jan Paepke 2013 (@janpaepke)

	Inspired by and partially based on the one and only SUPERSCROLLORAMA by John Polacek (@johnpolacek)
	johnpolacek.github.com/superscrollorama/

	Powered by the Greensock Tweening Platform
	http://www.greensock.com/js
	Greensock License info at http://www.greensock.com/licensing/

	Dual licensed under MIT and GPL.
	@author Jan Paepke, e-mail@janpaepke.de
*/

// TODO: consider if the controller needs Events
// TODO: test what happens if triggers ar tweened or pinned
// TODO: test / implement mobile capabilities
// TODO: make better logs for debugging. (consider what to log and where)
// TODO: Consider how the scene should behave, if you start scrolling back up DURING the scene and revers is false (ATM it will animate backwards)

(function($) {

/*
 * ----------------------------------------------------------------
 * avoid errors when using console
 * ----------------------------------------------------------------
 */
var console = (window.console = window.console || {});
if (!console['log']) {
	console.log = function () {};
}
if (!console['error']) {
	console.error = function (msg) {
		console.log(msg);
	};
}
if (!console['warn']) {
	console.warn = function (msg) {
		console.log(msg);
	};
}

     /**
     * CLASS ScrollMagic (main controller)
     *
     * (TODO: Description)
     *
     * @constructor
     *
	 * @param {object} [options] - An object containing one or more options for the controller.
	 * @param {(string|object)} [options.scrollContainer=$(window)] - A selector or a jQuery object that references the main container for scrolling.
     * @param {boolean} [options.isVertical=true] - Defines if the controller reacts to vertical (true) or horizontal (false) scrolling.
	 * @param {boolean} [options.reverse=true] - Global setting to prevent Scenes from reversing, when scrolling back up. Can be set globally here or individually for each scene.
	 * @param {number} [options.loglevel=2] - Loglevel for debugging. 0: none | 1: errors | 2: errors,warnings | 3: errors,warnings,debuginfo
     *
     */
	ScrollMagic = function(options) {

		var defaultOptions = {
			scrollContainer: $(window),
			isVertical: true,
			reverse: true,
			loglevel: 2
		};

		/*
		 * ----------------------------------------------------------------
		 * private vars
		 * ----------------------------------------------------------------
		 */

		var
			ScrollMagic = this,
			_options = $.extend({}, defaultOptions, options),
			_sceneObjects = [],
			_doUpdateOnNextTick = false,
			_currScrollPoint = 0,
			_containerInnerOffset = 0,
			_viewPortSize = 0;

		/*
		 * ----------------------------------------------------------------
		 * private functions
		 * ----------------------------------------------------------------
		 */

		/**
	     * Internal constructor function of ScrollMagic
	     * @private
	     */
		var construct = function () {
			// check ScrolContainer
			try {
				if (typeof _options.scrollContainer == "string")
					_options.scrollContainer = $(_options.scrollContainer).first();
				if (_options.scrollContainer.length == 0)
					throw "No valid scroll container supplied";
			} catch (e) {
				if (_options.loglevel >= 1)
					console.error("ERROR: " + e);
				return; // cancel
			}
			// set event handlers
			_options.scrollContainer.scroll(function() {
				_doUpdateOnNextTick = true;
			});
			_options.scrollContainer.resize(function() {
				_doUpdateOnNextTick = true;
			});
			TweenLite.ticker.addEventListener("tick", onTick);
			updateContainer();
		};

		/**
	     * Handle updates on tick instad of on scroll (performance)
	     * @private
	     */
		var onTick = function () {
			if (_doUpdateOnNextTick) {
				updateContainer();
				updateScenes();
				_doUpdateOnNextTick = false;
			}
		};

		/**
	     * Update container params.
	     * @private
	     */
		var updateContainer = function () {
			var
				vertical = _options.isVertical,
				$container = _options.scrollContainer,
				offset = $container.offset() || {top: 0, left: 0};

			_currScrollPoint = vertical ? $container.scrollTop() : $container.scrollLeft();
			_viewPortSize = vertical ? $container.height() : $container.width();
			// TODO: check usage of inner offset. Not very elegant atm. How to make better?
			if (offset.top != 0 || offset.left != 0) { // the container is not the window or document, but a div container
				// calculate the inner offset of the container, if the scrollcontainer is not at the top left position
				_containerInnerOffset = (vertical ? offset.top : offset.left) - _currScrollPoint;
			} else {
				_containerInnerOffset = 0;
			}
		};

		/**
	     * Update all scenes according to the scroll position of the container.
	     * @private
	     */
		var updateScenes = function () {
			$.each(_sceneObjects, function (index, scene) {
				updateScene(scene);
			});
		};

		/**
	     * Update a specific scene according to the scroll position of the container.
	     * @private
	     *
	     * @param {ScrollScene} scene - The ScollScene object that is supposed to be updated.
	     */
		var updateScene = function (scene) {
			var
				startPoint,
				endPoint,
				newProgress;

			// get the start position
			startPoint = scene.getTriggerOffset();

			// add optional offset
			startPoint -= scene.offset();

			// account for the possibility that the parent is a div, not the document
			startPoint -= _containerInnerOffset;

			// calculate start point in relation to viewport trigger point
			startPoint -= _viewPortSize*scene.triggerPosition();

			// where will the scene end?
			endPoint = startPoint + scene.duration();

			if (scene.duration() > 0) {
				newProgress = (_currScrollPoint - startPoint)/(endPoint - startPoint);
			} else {
				newProgress = _currScrollPoint > startPoint ? 1 : 0;
			}
			
			// startPoint is neccessary inside the class for the calculation of the fixed position for pins.
			scene.startPoint = startPoint;

			if (_options.loglevel >= 3)
				console.log({"scene" : $.inArray(scene, _sceneObjects)+1, "startPoint" : startPoint, "endPoint" : endPoint,"curScrollPoint" : _currScrollPoint});

			// TODO: consider setting startPoint and currScrollpoint instead of progress (startPoint won't have to be a public var anymore)
			scene.progress(newProgress);
		};


		/*
		 * ----------------------------------------------------------------
		 * public functions
		 * ----------------------------------------------------------------
		 */

		/**
	     * Add a Scene to the controller.
	     * @public
	     *
	     * @param {ScrollScene} scene - The ScollScene to be added.
	     * @return {ScrollMagic} - Parent object for chaining.
	     */
		this.add = function (ScrollScene) {
			_sceneObjects.push(ScrollScene);
			if (!_options.reverse) {
				ScrollScene.reverse(false);
			}
			ScrollScene.parent = ScrollMagic;
			// TODO: update this scene immediately? (might not be desired)
			ScrollScene.onChange(function () {
				updateScene(ScrollScene);
			});
			return ScrollMagic;
		};
		
		/**
		 * Remove scene from the controller.
		 * @public

		 * @param {ScrollScene} scene - The ScollScene to be removed.	
		 * @param {boolean} [reset=false] - Reset the pin and/or the animation
		 * @returns {ScrollMagic} Parent object for chaining.
		 */
		this.remove = function (ScrollScene, reset) {
			var index = $.inArray(ScrollScene, _sceneObjects);
			if (index > -1) {
				_sceneObjects.splice(index, 1);
				ScrollScene.removeTween(reset);
				ScrollScene.removePin(reset);
			}
			return ScrollMagic;
		};

		/**
	     * Shorthand function to add a scene to support easier chaining.
	     * @public
	     *
	     * @param {(string|object)} trigger - The ScollScene object that is supposed to be updated.
	     * @param {object} [options] - Options for the Scene. (Can be changed lateron)
	     * @param {number} [options.duration=0] - The duration of the scene. If 0 tweens will auto-play when reaching the trigger, pins will be pinned indefinetly starting at the trigger position.
	     * @param {number} [options.offset=0] - Offset Value for the Trigger Position
	     * @param {(float|string|function)} [options.triggerPosition="onEnter"] - Can be string "onCenter", "onEnter", "onLeave" or float (0 - 1), 0 = onLeave, 1 = onEnter or a function (returning a value from 0 to 1)
	     * @param {boolean} [options.reverse=true] - Should the scene reverse, when scrolling up?
	     * @param {boolean} [options.smoothTweening=false] - Tweens Animation to the progress target instead of setting it. Requires a TimelineMax Object for tweening. Does not affect animations where duration==0
	     * @param {number} [options.loglevel=2] - Loglevel for debugging. 0: none | 1: errors | 2: errors,warnings | 3: errors,warnings,debuginfo
	     * 
	     * @return {ScrollScene} New ScrollScene object for chaining.
	     * @see ScrollScene
	     */
		this.addScene = function (trigger, duration, options) {
			var newScene = new ScrollScene(trigger, duration, options);
			ScrollMagic.add(newScene);
			return newScene;
		};

		/**
	     * Force an update of all Scenes.
	     * @public
	     *
	     * @param {boolean} [immediately=false] - If true it will be updated right now, if false it will wait until next tweenmax tick
	     * @return {ScrollMagic} Parent object for chaining.
	     */
		this.updateScenes = function (immediately) {
			if (immediately) {
				updateScenes();
			} else {
				_doUpdateOnNextTick = true;
			}
			return ScrollMagic;
		};

		/**
		 * Get the scroll direction.
		 * @public
		 *
		 * @returns {boolean} - true if vertical scrolling, false if horizontal.
		 */
		this.vertical = function () {
			return _options.isVertical;
		};

		// INIT
		construct();
		return ScrollMagic;
	};


	/**
     * CLASS ScrollScene (scene controller)
     *
     * @constructor
     *
     * @param {(string|object)} trigger - The ScollScene object that is supposed to be updated.
     * @param {object} [options] - Options for the Scene. (Can be changed lateron)
     * @param {number} [options.duration=0] - The duration of the scene. If 0 tweens will auto-play when reaching the trigger, pins will be pinned indefinetly starting at the trigger position.
     * @param {number} [options.offset=0] - Offset Value for the Trigger Position
     * @param {(float|string|function)} [options.triggerPosition="onEnter"] - Can be string "onCenter", "onEnter", "onLeave" or float (0 - 1), 0 = onLeave, 1 = onEnter or a function (returning a value from 0 to 1)
     * @param {boolean} [options.reverse=true] - Should the scene reverse, when scrolling up?
     * @param {boolean} [options.smoothTweening=false] - Tweens Animation to the progress target instead of setting it. Requires a TimelineMax Object for tweening. Does not affect animations where duration==0
     * @param {number} [options.loglevel=2] - Loglevel for debugging. 0: none | 1: errors | 2: errors,warnings | 3: errors,warnings,debuginfo
     * 
     */
	ScrollScene = function (trigger, options) {
		// TODO: fire events (at The moment only onChange is fired properly)

		var defaultOptions = {
			duration: 0,
			offset: 0,
			triggerPosition: "onEnter",
			reverse: true,
			smoothTweening: false,
			loglevel: 2
		};

		/*
		 * ----------------------------------------------------------------
		 * private vars
		 * ----------------------------------------------------------------
		 */

		var
			ScrollScene = this,
			_trigger = typeof trigger === "string" ? $(trigger).first() : trigger,
			_options = $.extend({}, defaultOptions, options),
			_events = {},
			_state = 'BEFORE',
			_progress = 0,
			_tween,
			_pin;

		/*
		 * ----------------------------------------------------------------
		 * public vars
		 * ----------------------------------------------------------------
		 */

		 // TODO: document public vars
		 ScrollScene.parent = null;
		 ScrollScene.startPoint = 0;

		/*
		 * ----------------------------------------------------------------
		 * private functions
		 * ----------------------------------------------------------------
		 */

		/**
	     * Internal constructor function of ScrollMagic
	     * @private
	     */
		var construct = function () {
			checkOptionsValidity();
			// add Event listener to change spacer size on duration change
			ScrollScene.onChange(function (e) {
				if (e.what == "duration") {
					if (_state == "AFTER") {
						_state = "DURING"; // Force an update in case the pin zone got smaller, otherwise the pin would stick.
					}
					updatePinSpacerSize();
				}
			});
		};

		/**
	     * Check the validity of all options and reset to default if neccessary.
	     * @private
	     */
		var checkOptionsValidity = function () {
			if (_options.duration < 0) {
				if (_options.loglevel >= 1)
					console.error("ERROR: Invalid value for ScrollScene option \"duration\": " + _options.duration);
				_options.duration = 0;
			}
			if (typeof _options.offset !== "number") {
				if (_options.loglevel >= 1)
					console.error("ERROR: Invalid value for ScrollScene option \"offset\": " + _options.offset);
				_options.offset = 0;
			}
			if (typeof _options.triggerPosition !== "number" && $.inArray(_options.triggerPosition, ["onEnter", "onCenter", "onLeave"]) == -1) {
				if (_options.loglevel >= 1)
					console.error("ERROR: Invalid value for ScrollScene option \"triggerPosition\": " + _options.triggerPosition);
				_options.triggerPosition = "onCenter";
			}
			if (_tween) {
				if (_options.smoothTweening && !_tween.tweenTo) {
					if (_options.loglevel >= 2)
						console.warn("WARNING: ScrollScene option \"smoothTweening = true\" only works with TimelineMax objects!");
				}
			}
		};

		/**
	     * Update the tween progress.
	     * @private
	     *
	     * @param {number} [to] - If not set the scene Progress will be used. (most cases)
	     * @return {boolean} true if the Tween was updated. 
	     */
		var updateTweenProgress = function (to) {
			var
				updated = false;
				progress = (to === undefined) ? _progress : to;
			if (_tween) {
				updated = true;
				// check if the tween is an infinite loop (possible with TweenMax / TimelineMax)
				var infiniteLoop = _tween.repeat ? (_tween.repeat() === -1) : false;
				if (infiniteLoop) {
					if ((_state === "DURING" || (_state === "AFTER" && _options.duration == 0)) && _tween.paused()) {
						_tween.play();
						// TODO: optional: think about running the animation in reverse (.reverse()) when starting scene from bottom. Desired behaviour? Might require tween.yoyo() to be true
					} else if (_state !== "DURING" && !_tween.paused()) {
						_tween.pause();
					} else {
						updated = false;
					}
				} else {
					// no infinite loop - so should we just play or go to a specific point in time?
					if (_options.duration == 0) {
						// play the animation
						if (_state == "AFTER") { // play from 0 to 1
							_tween.play();
						} else { // play from 1 to 0
							_tween.reverse();
						}
					} else {
						// go to a specific point in time
						if (_options.smoothTweening && _tween.tweenTo) {
							// only works for TimelineMax
							_tween.tweenTo(progress);
						} else if (_tween.totalProgress) {
							// use totalProgress for TweenMax and TimelineMax to include repeats
							_tween.totalProgress(progress).pause();
						} else {
							// everything else
							_tween.pause(progress);
						}
					}
				}
				return updated;
			}
		};

		/**
	     * Update the pin progress.
	     * @private
	     */
		var updatePinProgress = function () {
			// TODO: check/test functionality – especially for horizontal scrolling
			var
				css;
			if (_pin && ScrollScene.parent) {
				var spacer =  _pin.parent();
				if (_state === "BEFORE") {
					// original position
					css = {
						position: "absolute",
						top: 0,
						left: 0
					}
				} else if (_state === "AFTER" && _options.duration > 0) { // if duration is 0 - we just never unpin
					// position after pin
					css = {
						position: "absolute",
						top: _options.duration,
						left: 0
					}
				} else {
					// position during pin
					var
						spacerOffset = spacer.offset(),
						fixedPosTop,
						fixedPosLeft;
					if (ScrollScene.parent.vertical()) {
						fixedPosTop = spacerOffset.top - ScrollScene.startPoint;
						fixedPosLeft = spacerOffset.left;
					} else {
						fixedPosTop = spacerOffset.top;
						fixedPosLeft = spacerOffset.left - ScrollScene.startPoint;
					}
					// TODO: make sure calculation is correct for all scenarios.
					css = {
						position: "fixed",
						top: fixedPosTop,
						left: fixedPosLeft
					}
				}
				_pin.css(css);
			}
		};


		/**
		 * Add an event handler to the class.
		 * @private
		 *
		 * @param {string} id - The name of the event.
		 */
		var addEventHandler = function (id) {
			//TODO: document
			var handleEvent = function (opt) {
				var name = "ScrollScene." + id;
				var defaultEvent = {
					name: name
				}
				if (!_events[name]) { _events[name] = []; } // create if non-existent
				// add callback or fire all?
				if (typeof opt === 'function') {
					// add new callback
					_events[name].push(opt);
				} else {
					if (typeof opt === 'object') {
						event = $.extend({}, defaultEvent, opt);
					} else {
						event = defaultEvent;
					}
					// fire all callbacks of the event
					$.each(_events[name], function (index, callback) {
						callback(event);
					});
				}
				return ScrollScene;
			};
			return handleEvent;
		}

		// TODO: document
		var updatePinSpacerSize = function () {
			if (_pin && ScrollScene.parent) {
				if (_pin.data("pushFollowers")) {
					if (ScrollScene.parent.vertical()) {
						var spacer = _pin.parent();
						spacer.height(_pin.data("startHeight") + _options.duration);
					} else {
						spacer.width(_pin.data("startWidth") + _options.duration);
					}
				}
			}
		}


		/*
		 * ----------------------------------------------------------------
		 * public functions
		 * ----------------------------------------------------------------
		 */

		/**
		 * Get trigger.
		 * @public
		 *
		 * @returns {(number|object)}
		 *//**
		 * Set trigger.
		 * @public
		 *
		 * @param {(number|object)} newTrigger - The new trigger of the scene.
		 * @returns {ScrollScene} Parent object for chaining.
		 */
		this.trigger = function (newTrigger) {
			if (!arguments.length) { // get
				return _trigger;
			} else { // set
				_trigger = typeof newTrigger === "string" ? $(newTrigger).first() : newTrigger;
				ScrollScene.onChange({what: "trigger"}); // fire event
				return ScrollScene;
			}
		};

		/**
		 * Get duration option value.
		 * @public
		 *
		 * @returns {number}
		 *//**
		 * Set duration option value.
		 * @public
		 *
		 * @param {number} newDuration - The new duration of the scene.
		 * @returns {ScrollScene} Parent object for chaining.
		 */
		this.duration = function (newDuration) {
			if (!arguments.length) { // get
				return _options.duration;
			} else { // set
				_options.duration = newDuration;
				checkOptionsValidity();
				ScrollScene.onChange({what: "duration"}); // fire event
				return ScrollScene;
			}
		};

		/**
		 * Get offset option value.
		 * @public
		 *
		 * @returns {number}
		 *//**
		 * Set offset option value.
		 * @public
		 *
		 * @param {number} newOffset - The new offset of the scene.
		 * @returns {ScrollScene} Parent object for chaining.
		 */
		this.offset = function (newOffset) {
			if (!arguments.length) { // get
				return _options.offset;
			} else { // set
				_options.offset = newOffset;
				checkOptionsValidity();
				ScrollScene.onChange({what: "offset"}); // fire event
				return ScrollScene;
			}
		};

		/**
		 * Get triggerPosition relative to viewport.
		 * @public
		 *
		 * @returns {number} A number from 0 to 1 that defines where on the viewport the offset and startPosition should be related to.
		 *//**
		 * Set triggerPosition option value.
		 * @public
		 *
		 * @param {(float|string|function)} newTriggerPosition - The new triggerPosition of the scene. See ScrollScene parameter description for value options.
		 * @returns {ScrollScene} Parent object for chaining.
		 */
		this.triggerPosition = function (newTriggerPosition) {
			if (!arguments.length) { // get
				var triggerPoint;
				// TODO: decide if really neccessary that it can be a function. After all it can also be set at will.
				if (typeof _options.triggerPosition === 'function') {
					triggerPoint = _options.triggerPosition();
				} else if (typeof _options.triggerPosition === 'number') {
					triggerPoint = _options.triggerPosition;
				} else {
					switch(_options.triggerPosition) {
						case "onCenter":
							triggerPoint = 0.5;
							break;
						case "onLeave":
							triggerPoint = 0;
							break;
						case "onEnter":
						default:
							triggerPoint = 1;
							break;
					}
				}
				return triggerPoint;
			} else { // set
				_options.triggerPosition = newTriggerPosition;
				checkOptionsValidity();
				ScrollScene.onChange({what: "triggerPosition"}); // fire event
				return ScrollScene;
			}
		};

		/**
		 * Get reverse option value.
		 * @public
		 *
		 * @returns {boolean}
		 *//**
		 * Set reverse option value.
		 * @public
		 *
		 * @param {boolean} newReverse - The new reverse setting of the scene.
		 * @returns {ScrollScene} Parent object for chaining.
		 */
		this.reverse = function (newReverse) {
			if (!arguments.length) { // get
				return _options.reverse;
			} else { // set
				_options.reverse = newReverse;
				checkOptionsValidity();
				ScrollScene.onChange({what: "reverse"}); // fire event
				return ScrollScene;
			}
		};

		/**
		 * Get smoothTweening option value.
		 * @public
		 *
		 * @returns {boolean}
		 *//**
		 * Set smoothTweening option value.
		 * @public
		 *
		 * @param {boolean} newSmoothTweening - The new smoothTweening setting of the scene.
		 * @returns {ScrollScene} Parent object for chaining.
		 */
		this.smoothTweening = function (newSmoothTweening) {
			if (!arguments.length) { // get
				return _options.smoothTweening;
			} else { // set
				_options.smoothTweening = newSmoothTweening;
				checkOptionsValidity();
				ScrollScene.onChange({what: "smoothTweening"}); // fire event
				return ScrollScene;
			}
		};


		/**
		 * Get Scene progress (0 - 1). 
		 * @public
		 *
		 * @returns {number}
		 *//**
		 * Set Scene progress.
		 * @public
		 *
		 * @param {number} progress - The new progress value of the scene (0 - 1).
		 * @returns {ScrollScene} Parent object for chaining.
		 */
		this.progress = function (progress) {
			if (!arguments.length) { // get
				return _progress;
			} else { // set
				var doUpdate = false;
				if (progress <= 0 && _state !== 'BEFORE' && (_state !== 'AFTER' || _options.reverse)) {
					// go back to initial state
					_progress = 0;
					doUpdate = true;
					_state = 'BEFORE';
				} else if (progress >= 1 && _state !== 'AFTER') {
					_progress = 1;
					doUpdate = true;
					_state = 'AFTER';
				} else if (progress > 0 && progress < 1 && (_state !== 'AFTER' || _options.reverse)) {
					_progress = progress;
					doUpdate = true;
					_state = 'DURING';
				}
				if (doUpdate) {
					updateTweenProgress();
					updatePinProgress();
					ScrollScene.onUpdate({progress: _progress}); // fire event
				}

				if (_options.loglevel >= 3)
					console.log({"progress" : _progress, "state" : _state, "reverse" : _options.reverse});

				return ScrollScene;
			}
		};

		/**
		 * Add a tween to the scene (one TweenMax object per scene!).
		 * @public
		 *
		 * @param {object} TweenMaxObject - A TweenMax object that should be animated during the scene.
		 * @returns {ScrollScene} Parent object for chaining.
		 */
		this.setTween = function (TweenMaxObject) {
			if (_tween) { // kill old tween?
				ScrollScene.removeTween();
			}
			try {
				_tween = TweenMaxObject.pause();
			} catch (e) {
				if (_options.loglevel >= 1)
					console.error("ERROR: Supplied argument is not a valid TweenMaxObject");
			} finally {
				checkOptionsValidity();
				return ScrollScene;
			}
		};

		/**
		 * Remove the tween from the scene.
		 * @public
		 *
		 * @param {boolean} [reset=false] - If true the tween weill be reset to start values.
		 * @returns {ScrollScene} Parent object for chaining.
		 */
		this.removeTween = function (reset) {
			if (_tween) {
				if (reset) {
					updateTweenProgress(0);
				}
				_tween.kill();
				_tween = null;
			}
			return ScrollScene;
		};


		/**
		 * Pin an element for the duration of the tween.
		 * @public
		 *
		 * @param {(string|object)} element - A Selctor or a jQuery object for the object that is supposed to be pinned.
		 * @param {object} [settings.pushFollowers=true] - If true following elements will be "pushed" down, if false the pinned element will just scroll past them
		 * @param {object} [settings.spacerClass="superscrollorama-pin-spacer"] - Classname of the pin spacer element
		 * @returns {ScrollScene} Parent object for chaining.
		 */
		this.setPin = function (element, settings) {
			var defaultSettings = {
				pushFollowers: true,
				spacerClass: "superscrollorama-pin-spacer"
			};

			// validate Element
			try {
				if (typeof(element) === 'string')
					element = $(element).first();
				if (element.length == 0)
					throw "Invalid pin element supplied.";
			} catch (e) {
				if (_options.loglevel >= 1)
					console.error("ERROR: " + e);
				return ScrollScene; // cancel
			}

			if (_pin) { // kill old pin?
				ScrollScene.removePin();
			}
			_pin = element;


			var
				settings = $.extend({}, defaultSettings, settings);


			// create spacer
			var spacer = $("<div>&nbsp;</div>") // for some reason a completely empty div can cause layout changes sometimes.
					.addClass(settings.spacerClass)
					.css({
						position: "relative",
						top: _pin.css("top"),
						left: _pin.css("left"),
						bottom: _pin.css("bottom"),
						right: _pin.css("right")
					})

			if (_pin.css("position") == "absolute") {
				// well this is easy.
				// TODO: Testing
				spacer.css({
						width: 0,
						height: 0
					});
			} else {
				// a little more challenging.
				spacer.css({
						display: _pin.css("display"),
						width: parseFloat(_pin.css("width")) + parseFloat(_pin.css("border-left")) + parseFloat(_pin.css("border-right")) + parseFloat(_pin.css("padding-left")) + parseFloat(_pin.css("padding-right")) + parseFloat(_pin.css("margin-left")) + parseFloat(_pin.css("margin-right")),
						height: parseFloat(_pin.css("height")) + parseFloat(_pin.css("border-top")) + parseFloat(_pin.css("border-bottom")) + parseFloat(_pin.css("padding-top")) + parseFloat(_pin.css("padding-bottom")) + parseFloat(_pin.css("margin-top")) + parseFloat(_pin.css("margin-bottom"))
					});
			}


			// now place the pin element inside the spacer	
			_pin.wrap(spacer)
					.data("style", _pin.attr("style") || "") // save old styles (for reset)
					.data("pushFollowers", settings.pushFollowers)
					.data("startWidth", spacer.width())
					.data("startHeight", spacer.height())
					.css({									// set new css
						position: "absolute",
						top: 0,
						left: 0
					});

			// update the size of the pin Spacer.
			updatePinSpacerSize();

			return ScrollScene;
		};

		
		/**
		 * Remove the pin from the scene.
		 * @public
		 *
		 * @param {boolean} [reset=false] - If false the spacer will not be removed and the element's position will not be reset.
		 * @returns {ScrollScene} Parent object for chaining.
		 */
		this.removePin = function (reset) {
			if (_pin) {
				var spacer = _pin.parent();
				if (reset || !ScrollScene.parent) { // if there's no parent no progress was made anyway...
					_pin.insertBefore(spacer)
						.attr("style", _pin.data("style"));
					spacer.remove();
				} else {
					var vertical = ScrollScene.parent.vertical();
					_pin.css({
						position: "absolute",
						top: vertical ? _options.duration * _progress : 0,
						left: vertical ? 0 : _options.duration * _progress
					});
				}
				_pin = null;
			}
			return ScrollScene;
		};
		
		/**
		 * Remove the scene from its parent controller.
		 * Can also be achieved using controller.remove(scene);
		 * @public
		 *
		 * @param {boolean} [reset=false] - If false the spacer will not be removed and the element's position will not be reset.
		 * @returns {null}
		 */
		this.remove = function (reset) {
			if (ScrollScene.parent) {
				ScrollScene.parent.remove(ScrollScene, reset);
			}
			return null;
		};
		
		/**
		 * Return the trigger offset.
		 * (always numerical, whereas trigger can also be a jQuery object)
		 * @public
		 *
		 * @returns {number} Numeric trigger offset, regardless if the trigger is an offset value or a jQuery object.
		 */
		this.getTriggerOffset = function () {
			if (typeof(_trigger) === 'number') {
				// numeric offset as trigger
                return _trigger
			} else {
				if (ScrollScene.parent) {
					// jQuery Object as trigger
					var targetOffset = _trigger.offset();
					return ScrollScene.parent.vertical() ? targetOffset.top : targetOffset.left;	
				} else {
					// if there's no parent yet we don't know if we're scrolling horizontally or vertically
					return 0;
				}
			}
		};

		/*
		 * ----------------------------------------------------------------
		 * events
		 * ----------------------------------------------------------------
		 */


		// TODO: document
		this.onStart = addEventHandler("onStart");

		// TODO: document
		this.onChange = addEventHandler("onChange");

		// TODO: document
		this.onUpdate = addEventHandler("onUpdate");

		// TODO: document
		this.onEnd = addEventHandler("onEnd");


		// INIT
		construct();
		return ScrollScene;
	}

})(jQuery);