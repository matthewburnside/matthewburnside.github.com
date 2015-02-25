
var BUCKET = "bu.rnsi.de";
var PREFIX = "photos/";

var router;

// Views
var Login = Backbone.View.extend({
    events: {
        "keydown #password": "login_attempt" 
    },
    template_ready: _.template($("#tmpl-login-ready").html()),
    template_success: _.template($("#tmpl-login-success").html()),
    initialize: function () {
        this.model.on("login:ready", this.render, this);
        this.model.on("login:success", this.render, this);
        this.model.on("logout:success", this.render, this);
    },
    render: function () {
        var tmpl = this.model.get("login:success")
            ? this.template_success
            : this.template_ready;
        this.$el.html(tmpl(this.model.toJSON())).fadeIn();
    },

    login_attempt: function () {
        if (event.keyCode != 13)
            return;
        this.model.login({
            username: $("#username").val(),
            password: $("#password").val(),
        });
    },
});

var EditView = (function () {
    var Edit, Index, Item;
    Edit = Backbone.View.extend({
        events: {
            "blur #title":  "subrender",
            "blur #date":   "subrender",
            "click .save": "save",
        },
        el: "body",
        template_header: _.template($("#tmpl-header").html()),
        template_footer: _.template($("#tmpl-footer").html()),
        initialize: function () {
            this.render();
            this.index_view = new Index({
                el: "#index",
                model: this.model.get("contents")
            });
            this.model.on("manifest:saving", this.saving, this);
            this.model.on("manifest:saved", this.saved, this);
        },
        render: function () {
            this.$el.append(this.template_header(this.model.toJSON()));
            this.$el.append(this.template_footer(this.model.toJSON()));
            $("#title").attr("contentEditable", true)
            $("#date").attr("contentEditable", true)
            this.subrender();
        },
        subrender: function () {
            this.model.set("title", $("#title").text());
            this.model.set("date", $("#date").text());
        },
        save: function () {
            this.model.save_manifest();
        },
        saving: function () {
            $(".save").html("Saving...");
        },
        saved: function () {
            window.setTimeout(function () {
                $(".save").html("Save");
            }, 150);
        }
    });
    Index = Backbone.View.extend({
        id: "index",
        tagName: "ol",
        initialize: function () {
            this.render();
        },
        render: function () {
            this.$el.empty();
            this.model.each(function (item) {
                var v = new Item({model: item});
                this.$el.append(v.el);
            }, this);
        }
    });
    Item = Backbone.View.extend({
        events: {
            "blur .caption":    "subrender",
            "click img":        "show"
        },
        template: _.template($("#tmpl-scroll-image-edit").html()),
        initialize: function () {
            this.render();
        },
        show: function () {
            this.model.set("show", !this.model.get("show"));
            if (this.model.get("show")) {
                this.$el.find(".item").removeClass("hide");
            } else {
                this.$el.find(".item").addClass("hide");
            }
        },
        render: function () {
            var that = this;
            this.$el.html(this.template(this.model.toJSON()));
            this.$el.find(".item").addClass("edit");
            if (this.model.get("show") == false)
                this.$el.find(".item").addClass("hide");
            this.$el.draggable({
                revert: "invalid",
                cursorAt: {top: 30},
                axis: "y",
                containment: "parent",
                scrollSensitivity: 80,
                scrollSpeed: 60,
                helper: function (e) {
                    return "<div id='dragging'></div>";
                },
                appendTo: "#index",
            });
            this.$el.droppable({
                hoverClass: "drop-hover",
                drop: function (event, ui) {
                    var m = $(ui.draggable).data("view").model;
                    var c = that.model.collection;
                    var i = c.indexOf(that.model);
                    c.remove(m, { silent: true });
                    c.add(m, { at: i });
                    $(ui.draggable).insertBefore(that.$el);
                    $(ui.draggable).css({"top" : ""});
                }
            });
            this.$el.data("view", this);
        },
        subrender: function () {
            this.model.set("caption", this.$el.find(".caption").text());
        },
    });
    return Edit;
})();

var ScrollView = (function () {
    var Scroll, Index, Item;
    Scroll = Backbone.View.extend({
        el: "body",
        template_header: _.template($("#tmpl-header").html()),
        template_footer: _.template($("#tmpl-footer").html()),
        initialize: function () {
            var that = this;
            this.render();
            this.index_view = new Index({
                el: "#index",
                model: this.model.get("contents")
            });
        },
        render: function () {
            this.$el.append(this.template_header(this.model.toJSON()));
            this.$el.append(this.template_footer(this.model.toJSON()));
        },
    });

    Index = Backbone.View.extend({
        id: "index",
        tagName: "ol",
        initialize: function () {
            this.scroll_horizon = 1024; // pixels
            this.scroll_init = 3;
            this.scroll_increment = 1;
            this.index = -1;
            this.more(this.scroll_init);
            _.bindAll(this, "handle_scroll");
            $(window).scroll(this.handle_scroll);
        
        },
        handle_scroll: function () {
            if (document.body.scrollHeight - $(window).scrollTop()
                < this.scroll_horizon) {
                this.more(this.scroll_increment);
            }
        },
        more: function (count) {
            for (var i = 0; i < count; i++) {
                var m;
                do {
                    m = this.model.at(++this.index);
                } while (this.index < this.model.length && !m.get("show"));
                var v = new Item({model: m});
                this.$el.append(v.el);
            }
        }
    });

    Item = Backbone.View.extend({
        className: "item",
        template: _.template($("#tmpl-scroll-image").html()),
        initialize: function () {
            this.render();
        },
        render: function () {
            this.$el.html(this.template(this.model.toJSON()));
            if (this.model.get("show") == false)
                this.$el.addClass("hide");
        },
    });

    return Scroll;
})();

var ListView = (function () {
    var List, Index, Item;
    List = Backbone.View.extend({
        el: "body",
        template_header: _.template($("#tmpl-header").html()),
        template_footer: _.template($("#tmpl-footer").html()),
        initialize: function () {
            var that = this;
            this.render();
            this.index_view = new Index({
                el: "#index",
                model: this.model.get("directories")
            });
        },
        render: function () {
            this.$el.append(this.template_header(this.model.toJSON()));
            this.$el.append(this.template_footer(this.model.toJSON()));
        },
    });

    Index = Backbone.View.extend({
        id: "index",
        tagName: "ol",
        initialize: function () {
            this.render();
        },
        render: function () {
            this.$el.empty();
            this.model.each(function (item) {
                var v = new Item({model: item});
                this.$el.append(v.el);
            }, this);
        }
    });

    Item = Backbone.View.extend({
        className: "list-item",
        tagName: "li",
        template: _.template($("#tmpl-list-item").html()),
        initialize: function () {
            this.render();
        },
        render: function () {
            this.$el.html(this.template(this.model.toJSON()));
        },
    });

    return List;
})();


// Router
var ScrollRouter = Backbone.Router.extend({
    routes: {
        "":                 "list",
        ":manifest":        "view",
        ":manifest/edit":   "edit",
    },
    initialize: function () {
        this.manifest = new s3.Manifest();
        this.listing = new s3.Listing();
    },
    path: function (model, path) {
        var display = path.replace(/ /g, "-")
        var actual = path.replace(/-/g, " ")
        model.set("path", PREFIX + encodeURIComponent(actual) + "/");
        model.set("actual", actual);
        model.set("display", display);
    },
    list: function () {
        var that = this;
        this.listing.fetch({
            success: function() {
                that.list_view = new ListView({model: that.listing});
            },
            error: function () {
            }
        }); 
    },
    view: function (path) {
        var that = this;
        this.path(this.manifest, path);
        this.manifest.fetch({
            success: function() {
                that.scroll_view = new ScrollView({model: that.manifest});
            },
            error: function() {
                $("#scroll").html("<h1>Not found: " + path + "</h1>");
            }
        });
    }
});

s3.bucket(BUCKET).prefix(PREFIX);

router = new ScrollRouter();
Backbone.history.start({root: "scroll.html"});
