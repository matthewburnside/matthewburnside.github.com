
var BUCKET = "bu.rnsi.de";
var PREFIX = "photos/";

var router;

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
            this.$el.html('');
            this.$el.append(this.template_header(this.model.toJSON()));
            this.$el.append(this.template_footer(this.model.toJSON()));
        },
    });

    Index = Backbone.View.extend({
        id: "index",
        tagName: "ol",

        render: function () {
            this.model.each(function (item) {
                if (item.get("show"))
                    var v = new Item({model: item});
                    this.$el.append(v.el);
            });
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
            return this.el;
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
            this.$el.html('');
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
