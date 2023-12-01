
// todo:
// crossword search
// synonyms
// bbc basic
// jenkins
// github actions
// artifactory
// terraform

let engines = {
  "alpine": "https://pkgs.alpinelinux.org/contents?file=%s&path=&name=&branch=edge",
  "arxiv": "https://arxiv.org/search/?query=%s&searchtype=all&source=header",
  "aws": "https://docs.aws.amazon.com/search/doc-search.html?searchPath=documentation&searchQuery=%s",
  "debian": "https://packages.debian.org/search?searchon=names&keywords=%s",
  "docker": "https://docs.docker.com/reference/?=%s",
  "duckduckgo": "https://duckduckgo.com/?t=h_&ia=web&q=%s",
  "elastic": "https://www.elastic.co/search?q=%s&size=n_20_n&filters%5B0%5D%5Bfield%5D=website_area&filters%5B0%5D%5Bvalues%5D%5B0%5D=documentation&filters%5B0%5D%5Btype%5D=all",
  "french": "https://translate.google.com/?tl=fr&sl=en&text=%s&op=translate",
  "genius": "https://genius.com/search?q=%s",
  "git": "https://git-scm.com/search/results?search=%s",
  "github": "https://github.com/search?q=%s&type=repositories",
  "githubdocs": "https://docs.github.com/en/search?query=%s",	
  "giphy": "https://giphy.com/search/%s",
  "golang": "https://pkg.go.dev/search?q=%s&m=",
  "google": "https://www.google.com/search?q=%s",
  "googlemaps": "https://www.google.com/maps/search/%s",
  "homebrew": "https://formulae.brew.sh/formula/%s",
  "imdb": "https://www.imdb.com/find/?q=%s",
  "istio": "https://istio.io/latest/search/?q=%s",
  "kubernetes": "https://kubernetes.io/search/?q=%s",
  "tldp": "https://cse.google.com/cse?cx=017644269519104757279%3Agm62gtzaoky&q=%s&sa=go",
  "mdn": "https://developer.mozilla.org/en-US/search?q=%s",
  "metacritic": "https://www.metacritic.com/search/%s/?page=1&category=13",
  "mysql": "https://dev.mysql.com/doc/search/?q=%s",
  "postgresql": "https://www.postgresql.org/search/?q=%s",
  "python": "https://docs.python.org/3/search.html?q=%s",
  "pypi": "https://pypi.org/search/?q=%s",
  "ruby": "https://cse.google.com/cse?q=%s&cx=013598269713424429640%3Ag5orptiw95w&ie=UTF-8&sa=Search",
  "so": "https://stackoverflow.com/search?q=%s",
  "translate": "https://translate.google.com/?sl=auto&tl=en&text=%s&op=translate",
  "vim": "https://cse.google.com/cse?cx=partner-pub-3005259998294962%3Abvyni59kjr1&ie=ISO-8859-1&q=%s&sa=Search",
  "wiki": "https://en.wikipedia.org/w/index.php?search=%s&title=Special%3ASearch&ns0=1",
  "wiktionary": "https://en.wiktionary.org/w/index.php?search=%s&title=Special%3ASearch&ns0=1",
  "wolframalpha": "https://www.wolframalpha.com/input?i=%s",
  "youtube": "https://www.youtube.com/results?search_query=%s"
}

// these have no native search engine, so just do a site search
let sites = {
  "lua": "www.lua.org",
  "nginx": "nginx.org",
  "rails": "rubyonrails.org",
  "terraform": "registry.terraform.io", // the site search is terrible
}

for (const [key, value] of Object.entries(sites)) {
  engines[key] = `https://duckduckgo.com/?t=h_&ia=web&q=site:${value}+%s`;
}

let aliases = {
  "apk": "alpine",
  "apt": "debian",
  "apt-get": "debian",
  "bash": "tldp",
  "brew": "homebrew",
  "calc": "wolframalpha",
  "chart": "wolframalpha",
  "convert": "wolframalpha",
  "css": "mdn",
  "define": "wiktionary",
  "dict": "wiktionary",
  "elk": "elastic",
  "game": "metacritic",
  "gh": "github",
  "gha": "githubdocs",
  "ghd": "githubdocs",
  "ghe": "githubdocs",
  "gif": "giphy",
  "go": "golang",
  "graph": "wolframalpha",
  "html": "mdn",
  "js": "mdn",
  "k8s": "kubernetes",
  "linux": "tldp",
  "lyrics": "genius",
  "man": "ldtp",
  "map": "googlemaps",
  "meaning": "wiktionary",
  "paper": "arxiv",
  "pg": "postgresql",
  "postgres": "postgresql",
  "sed": "tldp",
  "so": "stackoverflow",
  "sum": "wolframalpha",
  "tf": "terraform",
  "yt": "youtube",
}

for (const [key, value] of Object.entries(aliases)) {
  engines[key] = engines[value];
}

function do_search(needle) {
   let [keyword, ...rest] = needle.split(" ");
   // sometimes the keyword should be passed in with the query.
   let keep = ["bash", "man", "sed", "convert"];
   let terms = keep.includes(keyword) || !Object.hasOwn(engines,keyword) ? needle : rest.join(" ");
   engine = engines[keyword] || engines['duckduckgo'];
   window.location = engine.replace("%s", encodeURIComponent(terms));
}

function do_submit(event) {
  event.preventDefault();
  const fd = new FormData(event.target);
  do_search(fd.get("q"));
}

if (window.location.hash) {
  do_search(decodeURIComponent(window.location.hash));
}
addEventListener("submit", do_submit);

