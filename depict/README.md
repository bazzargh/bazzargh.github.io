# DEPICT

This is a diagramming tool where you type descriptions of what you want to appear,
instead of drawing them (it is "de-pic'd") and the tool animates your changes
as you type or navigate history. It's intended for presentations, ad-hoc
design discussions, etc. It does automatic layout of boxes and connections,
which is what makes it quick to use, the tradeoff is a lack of flexibility
in what can be depicted.

The collection of icons all came from https://github.com/mingrammer/diagrams,
but this contains no code from that repository; those icons are owned by
their creators (aws, google, microsoft, and so on)

# USAGE

Normally you can just go to https://bazzargh.github.io/depict/. Editing the
diagram makes a bookmarkable url for the diagram.

Example:
https://bazzargh.github.io/depict/?q=add+aws%0Aadd+gcp%0Aadd+azure%0Aadd+internet%0Azoom+aws+layout+zigzag%0Aadd+aws%3Adocker%0Aadd+aws%3Anginx%0Aadd+aws%3Aapache%0Aadd+aws%3Anodejs%0Aadd+aws%3Atomcat%0Aup%0Azoom+gcp+layout+ring%0Aadd+gcp%3Adocker%0Aadd+gcp%3Anginx%0Aadd+gcp%3Aapache%0Aadd+gcp%3Anodejs%0Aadd+gcp%3Atomcat%0Aup%0Aarrow+aws%3Adocker+gcp%3Adocker%0Aarrow+aws%3Anginx+gcp%3Anginx+red%0Aline+aws%3Atomcat+gcp%3Atomcat+blue%0Azoom+internet+layout+row%0Aadd+one%0Aadd+two%0Aadd+three%0Aup%0Azoom+azure+layout+column%0Aadd+azure%3Aone%0Aadd+azure%3Atwo%0Aadd+azure%3Athree%0Azoom+azure%0Aup%0A

The `icons.rb` script is used to regenerate icons.js, like `ruby icons.rb > icons.js`.

If you want, you can check it out and run it locally by running `python3 -m http.server`

You just type what you want to see in the panel on the right, it draws a diagram
and tries to lay it out reasonably. The commands you can include are all one per line
and look like:

* `add <node> <options>`: adds a node to the node currently being edited (which defaults to 'top').
Node names are normally formatted like identifiers in code, but you can use a name like `this:that`,
where `that` is used as the display title and for the icon, while `this` is used to 'namespace' the name-
this is useful when drawing multiple instances of a thing.
* `edit <node> <options>`: changes the currently edited node to the named one, adding
it if it is missing, and applying the selected options.
* `zoom <node> <options>`: changes the top-level zoomed node to the named one, applying options, and starts
editing it. (ie `edit <node>` is also implied)
* `up`: zoom to parent and starts editing it.
* `top`: zoom to top and starts editing it.
* `delete <node>`: removes a node.
* `line <node1> <node2> [<colour>]`: draw a curved line between nodes, optionally coloured. Colouring a
line will also change its dashing, so that diagrams work for the colour-blind. If the nodes referred to don't
exist, they will be created.
* `arrow <node1> <node2> [<colour>]`: same as `line` but with an arrowhead.
* `disconnect <node1> <node2>`: removes a line.

The options supported by `add/edit/zoom` are zero or more of these:
* `layout <style>`: where style is `zigzag` (the default), `ring`, `row` or `column`. A zigzag layout fills space
with boxes, from left to right then right to left and so on. A ring layout lays the nodes out on an ellipse.
A 'row' layout splits the layout into rows separated by dashed lines, column works the other way up.
* `icon <name>` if the guessed icon isn't what you want, you can change it.
* `title <title>` by default the title is derived from the node id, but you can change that. You can use
quoted strings here.

Arrows and lines also support specifying colour/dashing with `stroke <colour>`; another attribute supported
by connectors is `label`, eg `label one` or `label "one two"`. Labels are drawn with a glow so they don't get
made unreadable by the lines they are sitting on top of (since there's no way to control the position of labels)


# ICONS

Icon attributes, eg `icon:s3` use AWS/K8S/GCP official icon sets. With so many services, I have had
to guess at acronyms by taking leading letters after removing punctuation; an 'aws/amazon-certificate-manager'
icon may also exist as 'cm', aws/cm' (dropping 'amazon'), 'acm', 'aws/acm', 'amazon-certificate-manager',
'certificate-manager', 'aws/certificate-manager'. 's3' is a special case and has had its alias added (it
was 'amazon-simple-storage-service', so got aliases like 'asss', 'sss'...)

As a special case, if you say a shape is eg 's3' instead of 'box', it treats that as 'box icon:s3', and so on,
and the shape will be defined (so you can change other properties, and have them inherited)
In this way, most resources automatically get shapes defined. It's magic.

