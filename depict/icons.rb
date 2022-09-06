require 'json'

icon_paths = {}

Dir.glob("resources/**/*.png").each do |path|
  icon_paths[path[10..-5]] = path
end
puts <<-END_SCRIPT
const icon_paths = #{JSON.generate(icon_paths)};
/* in increasing preference so that indexOf anything not on the list is a lower number */
const icon_preference = ['openstack', 'saas', 'elastic', 'oci', 'generic', 'programming', 'onprem', 'gcp', 'k8s', 'aws'];
const icon_cache = {};
/* since I can't do autocompletion for icons, and 1600(!)
   is a lot to browse, encourage playful use: make anything
   you type return a near match
   For any sequence of characters, find icons which contain
   that same sequence in the same order, preferring where the
   match (the sequence with other, filler characters) is
   short - ie less filler - and where the icon name is short,
   ie fewer extra characters.
*/
function lookup_icon(key) {
  if (!key) {
    key = "blank";
  }
  if (!Object.hasOwn(icon_cache, key)) {
    var pattern = key.split("").join(".*");
    var regex = new RegExp(`.*(${pattern})`, 'i');
    var matches = Object.keys(icon_paths).map(function(s) {
      var m = s.match(regex);
      if (m) {
        var prefix = s.split("/")[0]
        return [m[1].length, icon_preference.indexOf(prefix), s.length, s]
      }
      if (s == "generic/blank/blank") {
        return [998, 0, 0, s]
      }
      return [999, 0, 0, s]
    })
    matches = matches.sort(([a, b, c, d], [e, f, g, h]) => a - e || f - b || c - g || d.localeCompare(h));
    var best = matches[0];
    icon_cache[key] = icon_paths[best[3]];
  }
  return icon_cache[key];
}
END_SCRIPT
