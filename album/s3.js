
var s3 = function () {
    var my = {};
    var bucket, prefix;

    my.bucket = function(value) {
        if (!arguments.length) return bucket;
        bucket = value;
        return my;
    };

    my.prefix = function(value) {
        if (!arguments.length) return prefix;
        prefix = value;
        return my;
    };

    my.Listing = Backbone.Model.extend({
        url: function () {
            return "http://" + my.bucket() + "?delimiter=/&prefix="+my.prefix();
        },
        parse: function (xml) {
            var d = [];
            $(xml).find("CommonPrefixes").each(function () {
                var path = $(this).find("Prefix").text();
                var display = path.split("/")[1].replace(/ /g, "-");
                d.push({
                    "display": display,
                    "path": path
                });
            });
            d.sort(function (a, b) {
                if (a.display > b.display) {
                    return -1;
                }
                if (a.display < b.display) {
                    return 1;
                }
                // a must be equal to b
                return 0;
            });
            return {
                "title": "Listing",
                "date": "",
                "directories": new Backbone.Collection(d)
            };
        },
        fetch: function (options) {
            options = options || {};
            options.dataType = "xml";
            return Backbone.Model.prototype.fetch.call(this, options);
        }
    });


    my.Manifest = Backbone.Model.extend({
        dataType: "json",
        parse: function (json) {
            if (json.getResponseHeader)
                return;
            var contents = _.map(json.contents, function (item) {
                item.path = this.get("path") + item.name;
                item.thumbpath = this.get("path") + item.name.replace(/.jpg/i,
                    function (m) { return ".thumb" + m; });
                item.url = "http://" + my.bucket() + "/" + item.path;
                item.thumb = "http://" + my.bucket() + "/" + item.thumbpath;
                item.show = (item.show == "true" || item.show == true)
                    ? true
                    : false;
                return item;
            }, this);
            return {
                "title": json.title,
                "date": json.date,
                "version": json.version,
                "contents": new Backbone.Collection(contents)
            };
        },
        sync: function (method, model, options) {
            options || (options = {});
            success = options.success || function () { return null; };
            error = options.error || function () { return null; };
            options.error = function (model, xhr, options) {
                if (xhr.status === 200 && xhr.responseText === "") {
                    success(model, xhr, options);
                } else {
                    error(model, xhr, options);
                }
            };
            switch (method) {
            case "read":
                options.url = "http://" + my.bucket() + "/" 
                    + this.get("path") + "manifest.json";
                break;
            default:
                console.log("unknown method");
                break;
            }
            return Backbone.sync(method, model, options);
        },
        toJSON: function () {
            json = _.omit(this.attributes, "actual", "display", "path", "auth");
            json.contents = _.map(this.get("contents").toJSON(),function (item){
                return _.omit(item, "thumb", "path");
            });
            return json;
        },
    });

    return my;
}();

