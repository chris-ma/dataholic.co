require 'factory_girl_rails'


RSpec.configure do |config|

  config.include FactoryGirl::Syntax::Methods


  config.backtrace_exclusion_patterns = [
    /\.rvm/
  ]


  config.expect_with :rspec do |expectations|
 

    expectations.include_chain_clauses_in_custom_matcher_descriptions = true
  end

  config.mock_with :rspec do |mocks|

    mocks.verify_partial_doubles = true
  end

end
